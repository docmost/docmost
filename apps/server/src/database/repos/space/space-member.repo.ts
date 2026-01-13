import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { sql } from 'kysely';
import {
  InsertableSpaceMember,
  SpaceMember,
  UpdatableSpaceMember,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { MemberInfo, UserSpaceRole } from './types';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';

@Injectable()
export class SpaceMemberRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly spaceRepo: SpaceRepo,
  ) {}

  async insertSpaceMember(
    insertableSpaceMember: InsertableSpaceMember,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('spaceMembers')
      .values(insertableSpaceMember)
      .returningAll()
      .execute();
  }

  async updateSpaceMember(
    updatableSpaceMember: UpdatableSpaceMember,
    spaceMemberId: string,
    spaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('spaceMembers')
      .set(updatableSpaceMember)
      .where('id', '=', spaceMemberId)
      .where('spaceId', '=', spaceId)
      .execute();
  }

  async getSpaceMemberByTypeId(
    spaceId: string,
    opts: {
      userId?: string;
      groupId?: string;
    },
    trx?: KyselyTransaction,
  ): Promise<SpaceMember> {
    const db = dbOrTx(this.db, trx);
    let query = db
      .selectFrom('spaceMembers')
      .selectAll()
      .where('spaceId', '=', spaceId);
    if (opts.userId) {
      query = query.where('userId', '=', opts.userId);
    } else if (opts.groupId) {
      query = query.where('groupId', '=', opts.groupId);
    } else {
      throw new BadRequestException('Please provide a userId or groupId');
    }
    return query.executeTakeFirst();
  }

  async removeSpaceMemberById(
    memberId: string,
    spaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('spaceMembers')
      .where('id', '=', memberId)
      .where('spaceId', '=', spaceId)
      .execute();
  }

  async roleCountBySpaceId(role: string, spaceId: string): Promise<number> {
    const { count } = await this.db
      .selectFrom('spaceMembers')
      .select((eb) => eb.fn.count('role').as('count'))
      .where('role', '=', role)
      .where('spaceId', '=', spaceId)
      .executeTakeFirst();

    return count as number;
  }

  async getSpaceMembersPaginated(
    spaceId: string,
    pagination: PaginationOptions,
  ) {
    let query = this.db
      .selectFrom('spaceMembers')
      .leftJoin('users', 'users.id', 'spaceMembers.userId')
      .leftJoin('groups', 'groups.id', 'spaceMembers.groupId')
      .select([
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
        'spaceMembers.role',
        'spaceMembers.createdAt',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .where('spaceId', '=', spaceId)
      .orderBy((eb) => eb('groups.id', 'is not', null), 'desc')
      .orderBy('spaceMembers.createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(users.name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        )
          .or(
            sql`users.email`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          )
          .or(
            sql`f_unaccent(groups.name)`,
            'ilike',
            sql`f_unaccent(${'%' + pagination.query + '%'})`,
          ),
      );
    }

    const result = await executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    let memberInfo: MemberInfo;

    const members = result.items.map((member) => {
      if (member.userId) {
        memberInfo = {
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
          avatarUrl: member.userAvatarUrl,
          type: 'user',
        };
      } else if (member.groupId) {
        memberInfo = {
          id: member.groupId,
          name: member.groupName,
          memberCount: member.memberCount as number,
          isDefault: member.groupIsDefault,
          type: 'group',
        };
      }

      return {
        ...memberInfo,
        role: member.role,
        createdAt: member.createdAt,
      };
    });

    result.items = members as any;

    return result;
  }

  /*
   * we want to get a user's role in a space.
   * they user can be a member either directly or via a group
   * we will pass the user id and space id to return the user's roles
   * if the user is a member of the space via multiple groups
   * if the user has no space permission it should return an empty array,
   * maybe we should throw an exception?
   */
  async getUserSpaceRoles(
    userId: string,
    spaceId: string,
  ): Promise<UserSpaceRole[]> {
    const roles = await this.db
      .selectFrom('spaceMembers')
      .select(['userId', 'role'])
      .where('userId', '=', userId)
      .where('spaceId', '=', spaceId)
      .unionAll(
        this.db
          .selectFrom('spaceMembers')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
          .select(['groupUsers.userId', 'spaceMembers.role'])
          .where('groupUsers.userId', '=', userId)
          .where('spaceMembers.spaceId', '=', spaceId),
      )
      .execute();

    if (!roles || roles.length === 0) {
      return undefined;
    }
    return roles;
  }

  getUserSpaceIdsQuery(userId: string) {
    return this.db
      .selectFrom('spaceMembers')
      .innerJoin('spaces', 'spaces.id', 'spaceMembers.spaceId')
      .select('spaces.id')
      .where('userId', '=', userId)
      .union(
        this.db
          .selectFrom('spaceMembers')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'spaceMembers.groupId')
          .innerJoin('spaces', 'spaces.id', 'spaceMembers.spaceId')
          .select('spaces.id')
          .where('groupUsers.userId', '=', userId),
      );
  }

  async getUserSpaceIds(userId: string): Promise<string[]> {
    const membership = await this.getUserSpaceIdsQuery(userId).execute();
    return membership.map((space) => space.id);
  }

  async getUserSpaces(userId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('spaces')
      .selectAll()
      .select((eb) => [this.spaceRepo.withMemberCount(eb)])
      .where('id', 'in', this.getUserSpaceIdsQuery(userId))
      .orderBy('createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent(name)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ).or(
          sql`f_unaccent(description)`,
          'ilike',
          sql`f_unaccent(${'%' + pagination.query + '%'})`,
        ),
      );
    }

    return executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });
  }
}
