import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { DB, Users } from '@docmost/db/types/db';
import { hashPassword } from '../../../common/helpers';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertableUser,
  UpdatableUser,
  User,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder, sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { NotificationSettingKey } from '../../../core/notification/notification.constants';
import { WorkspaceUserListStatus } from '../../../core/workspace/workspace.constants';

@Injectable()
export class UserRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  // timezone is private to its owner, see findById's includeTimezone
  public baseFields: Array<keyof Users> = [
    'id',
    'email',
    'name',
    'emailVerifiedAt',
    'avatarUrl',
    'role',
    'workspaceId',
    'locale',
    'settings',
    'lastLoginAt',
    'deactivatedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'hasGeneratedPassword',
  ];

  // what member lists return about other users
  public memberFields: Array<keyof Users> = [
    'id',
    'email',
    'name',
    'avatarUrl',
    'role',
    'workspaceId',
    'deactivatedAt',
    'updatedAt',
    'deletedAt',
  ];

  // added for admins and owners
  public adminFields: Array<keyof Users> = [
    'lastLoginAt',
    'emailVerifiedAt',
    'createdAt',
  ];

  // a user's own record also carries their timezone
  private ownFields: Array<keyof Users> = [...this.baseFields, 'timezone'];

  async findById(
    userId: string,
    workspaceId: string,
    opts?: {
      includePassword?: boolean;
      includeUserMfa?: boolean;
      includeScimExternalId?: boolean;
      includeTimezone?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<User> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('users')
      .select(this.baseFields)
      .$if(opts?.includePassword, (qb) => qb.select('password'))
      .$if(opts?.includeUserMfa, (qb) => qb.select(this.withUserMfa))
      .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
      .$if(opts?.includeTimezone, (qb) => qb.select('timezone'))
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findByEmail(
    email: string,
    workspaceId: string,
    opts?: {
      includePassword?: boolean;
      includeUserMfa?: boolean;
      includeScimExternalId?: boolean;
      trx?: KyselyTransaction;
    },
  ): Promise<User> {
    const db = dbOrTx(this.db, opts?.trx);
    return db
      .selectFrom('users')
      .select(this.baseFields)
      .$if(opts?.includePassword, (qb) => qb.select('password'))
      .$if(opts?.includeUserMfa, (qb) => qb.select(this.withUserMfa))
      .$if(opts?.includeScimExternalId, (qb) => qb.select('scimExternalId'))
      .where(sql`LOWER(email)`, '=', sql`LOWER(${email})`)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findActiveNamesByIds(
    userIds: string[],
    workspaceId: string,
  ): Promise<{ id: string; name: string }[]> {
    if (userIds.length === 0) return [];
    return this.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('id', 'in', userIds)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .execute();
  }

  async updateUser(
    updatableUser: UpdatableUser,
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);

    return await db
      .updateTable('users')
      .set({ ...updatableUser, updatedAt: new Date() })
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async updateLastLogin(userId: string, workspaceId: string) {
    return await this.db
      .updateTable('users')
      .set({
        lastLoginAt: new Date(),
      })
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();
  }

  async insertUser(
    insertableUser: InsertableUser,
    trx?: KyselyTransaction,
    opts?: { pageEditMode?: string; locale?: string },
  ): Promise<User> {
    const user: InsertableUser = {
      name:
        insertableUser.name || insertableUser.email.split('@')[0].toLowerCase(),
      email: insertableUser.email.toLowerCase(),
      password: await hashPassword(insertableUser.password),
      locale: opts?.locale ?? 'en-US',
      role: insertableUser?.role,
      lastLoginAt: new Date(),
    };

    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('users')
      .values({
        ...insertableUser,
        ...user,
        ...(opts?.pageEditMode
          ? {
              settings: sql`${JSON.stringify({
                preferences: { pageEditMode: opts.pageEditMode },
              })}::text::jsonb`,
            }
          : {}),
      })
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async roleCountByWorkspaceId(
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const { count } = await db
      .selectFrom('users')
      .select((eb) => eb.fn.count('role').as('count'))
      .where('role', '=', role)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .executeTakeFirst();

    return count as number;
  }

  async getUsersPaginated(
    workspaceId: string,
    pagination: PaginationOptions,
    opts?: { status?: WorkspaceUserListStatus; adminView?: boolean },
  ) {
    const status = opts?.status ?? 'active';

    let query = this.db
      .selectFrom('users')
      .select(this.memberFields)
      .$if(opts?.adminView, (qb) => qb.select(this.adminFields))
      .where('workspaceId', '=', workspaceId)
      .$if(status === 'deleted', (qb) => qb.where('deletedAt', 'is not', null))
      .$if(status === 'active' || status === 'deactivated', (qb) =>
        qb
          .where('deletedAt', 'is', null)
          .where('deactivatedAt', status === 'active' ? 'is' : 'is not', null),
      );

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(users.name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ).or(
          sql`users.email`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ),
      );
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'name', direction: 'asc' },
        { expression: 'id', direction: 'asc' },
      ],
      parseCursor: (cursor) => ({ name: cursor.name, id: cursor.id }),
    });
  }

  async updatePreference(
    userId: string,
    prefKey: string,
    prefValue: string | boolean,
  ) {
    return await this.db
      .updateTable('users')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('preferences', COALESCE(settings->'preferences', '{}'::jsonb) 
                || jsonb_build_object('${sql.raw(prefKey)}', ${sql.lit(prefValue)}))`,
        updatedAt: new Date(),
      })
      .where('id', '=', userId)
      .returning(this.ownFields)
      .executeTakeFirst();
  }

  async updateNotificationSetting(
    userId: string,
    settingKey: NotificationSettingKey,
    settingValue: boolean,
  ) {
    return await this.db
      .updateTable('users')
      .set({
        settings: sql`COALESCE(settings, '{}'::jsonb)
                || jsonb_build_object('notifications', COALESCE(settings->'notifications', '{}'::jsonb)
                || jsonb_build_object(${sql.lit(settingKey)}, ${sql.lit(settingValue)}))`,
        updatedAt: new Date(),
      })
      .where('id', '=', userId)
      .returning(this.ownFields)
      .executeTakeFirst();
  }

  withUserMfa(eb: ExpressionBuilder<DB, 'users'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('userMfa')
        .select([
          'userMfa.id',
          'userMfa.method',
          'userMfa.isEnabled',
          'userMfa.createdAt',
        ])
        .whereRef('userMfa.userId', '=', 'users.id'),
    ).as('mfa');
  }
}
