import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import {
  InsertableSpaceMember,
  SpaceMember,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { MemberInfo } from './types';
import { sql } from 'kysely';

@Injectable()
export class SpaceMemberRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertSpaceMember(
    insertableSpaceMember: InsertableSpaceMember,
    trx?: KyselyTransaction,
  ): Promise<SpaceMember> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('space_members')
          .values(insertableSpaceMember)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async getSpaceMembersPaginated(
    spaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    return executeTx(this.db, async (trx) => {
      const spaceMembers = await trx
        .selectFrom('space_members')
        .leftJoin('users', 'users.id', 'space_members.userId')
        .leftJoin('groups', 'groups.id', 'space_members.groupId')
        .select([
          'groups.id as group_id',
          'groups.name as group_name',
          'groups.isDefault as group_isDefault',
          'groups.id as groups_id',
          'groups.id as groups_id',
          'groups.id as groups_id',
          'users.id as user_id',
          'users.name as user_name',
          'users.avatarUrl as user_avatarUrl',
          'users.email as user_email',
          'space_members.role',
        ])
        .where('spaceId', '=', spaceId)
        .orderBy('space_members.createdAt', 'asc')
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let memberInfo: MemberInfo;

      const members = spaceMembers.map((member) => {
        if (member.user_id) {
          memberInfo = {
            id: member.user_id,
            name: member.user_name,
            email: member.user_email,
            avatarUrl: member.user_avatarUrl,
            type: 'user',
          };
        } else if (member.group_id) {
          memberInfo = {
            id: member.group_id,
            name: member.group_name,
            isDefault: member.group_isDefault,
            type: 'group',
          };
          // todo: member count
        }

        return {
          ...memberInfo,
          role: member.role,
        };
      });

      let { count } = await trx
        .selectFrom('space_members')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('spaceId', '=', spaceId)
        .executeTakeFirst();
      count = count as number;

      return { members, count };
    });
  }

  /*
   * we want to get all the spaces a user belongs either directly or via a group
   * we will pass the user id and workspace id as parameters
   * if the user is a member of the space via multiple groups
   * we will return the one with the highest role permission
   * it should return an array
   * Todo: needs more work. this is a draft
   */
  async getUserSpaces(userId: string, workspaceId: string) {
    const rolePriority = sql`CASE "space_members"."role"
                                  WHEN 'owner' THEN 3
                                  WHEN 'writer' THEN 2
                                  WHEN 'reader' THEN 1
    END`.as('role_priority');

    const subquery = this.db
      .selectFrom('spaces')
      .innerJoin('space_members', 'spaces.id', 'space_members.spaceId')
      .select([
        'spaces.id',
        'spaces.name',
        'spaces.slug',
        'spaces.icon',
        'space_members.role',
        rolePriority,
      ])
      .where('space_members.userId', '=', userId)
      .where('spaces.workspaceId', '=', workspaceId)
      .unionAll(
        this.db
          .selectFrom('spaces')
          .innerJoin('space_members', 'spaces.id', 'space_members.spaceId')
          .innerJoin(
            'group_users',
            'space_members.groupId',
            'group_users.groupId',
          )
          .select([
            'spaces.id',
            'spaces.name',
            'spaces.slug',
            'spaces.icon',
            'space_members.role',
            rolePriority,
          ])
          .where('group_users.userId', '=', userId),
      )
      .as('membership');

    const results = await this.db
      .selectFrom(subquery)
      .select([
        'membership.id as space_id',
        'membership.name as space_name',
        'membership.slug as space_slug',
        sql`MAX('role_priority')`.as('max_role_priority'),
        sql`CASE MAX("role_priority")
        WHEN 3 THEN 'owner'
        WHEN 2 THEN 'writer'
        WHEN 1 THEN 'reader'
        END`.as('highest_role'),
      ])
      .groupBy('membership.id')
      .groupBy('membership.name')
      .groupBy('membership.slug')
      .execute();

    let membership = {};

    const spaces = results.map((result) => {
      membership = {
        id: result.space_id,
        name: result.space_name,
        role: result.highest_role,
      };

      return membership;
    });

    return spaces;
  }

  /*
   * we want to get a user's role in a space.
   * they user can be a member either directly or via a group
   * we will pass the user id and space id and workspaceId to return the user's role
   * if the user is a member of the space via multiple groups
   * we will return the one with the highest role permission
   * It returns the space id, space name, user role
   * and how the role was derived 'via'
   * if the user has no space permission (not a member) it returns undefined
   */
  async getUserRoleInSpace(
    userId: string,
    spaceId: string,
    workspaceId: string,
  ) {
    const rolePriority = sql`CASE "space_members"."role"
                                  WHEN 'owner' THEN 3
                                  WHEN 'writer' THEN 2
                                  WHEN 'reader' THEN 1
    END`.as('role_priority');

    const subquery = this.db
      .selectFrom('spaces')
      .innerJoin('space_members', 'spaces.id', 'space_members.spaceId')
      .select([
        'spaces.id',
        'spaces.name',
        'space_members.role',
        'space_members.userId',
        rolePriority,
      ])
      .where('space_members.userId', '=', userId)
      .where('spaces.id', '=', spaceId)
      .where('spaces.workspaceId', '=', workspaceId)
      .unionAll(
        this.db
          .selectFrom('spaces')
          .innerJoin('space_members', 'spaces.id', 'space_members.spaceId')
          .innerJoin(
            'group_users',
            'space_members.groupId',
            'group_users.groupId',
          )
          .select([
            'spaces.id',
            'spaces.name',
            'space_members.role',
            'space_members.userId',
            rolePriority,
          ])
          .where('spaces.id', '=', spaceId)
          .where('spaces.workspaceId', '=', workspaceId)
          .where('group_users.userId', '=', userId),
      )
      .as('membership');

    const result = await this.db
      .selectFrom(subquery)
      .select([
        'membership.id as space_id',
        'membership.name as space_name',
        'membership.userId as user_id',
        sql`MAX('role_priority')`.as('max_role_priority'),
        sql`CASE MAX("role_priority")
        WHEN 3 THEN 'owner'
        WHEN 2 THEN 'writer'
        WHEN 1 THEN 'reader'
        END`.as('highest_role'),
      ])
      .groupBy('membership.id')
      .groupBy('membership.name')
      .groupBy('membership.userId')
      .executeTakeFirst();

    let membership = {};
    if (result) {
      membership = {
        id: result.space_id,
        name: result.space_name,
        role: result.highest_role,
        via: result.user_id ? 'user' : 'group', // user_id is empty then role was derived via a group
      };
      return membership;
    }
    return undefined;
  }

  async getSpaceMemberById(
    userId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ) {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .selectFrom('space_members')
          .selectAll()
          .where('userId', '=', userId)
          .where('groupId', '=', groupId)
          .executeTakeFirst();
      },
      trx,
    );
  }

  async removeUser(userId: string, spaceId: string): Promise<void> {
    await this.db
      .deleteFrom('space_members')
      .where('userId', '=', userId)
      .where('spaceId', '=', spaceId)
      .execute();
  }

  async removeGroup(groupId: string, spaceId: string): Promise<void> {
    await this.db
      .deleteFrom('space_members')
      .where('userId', '=', groupId)
      .where('spaceId', '=', spaceId)
      .execute();
  }
}
