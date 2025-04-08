import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import {
  InsertablePageMember,
  InsertableSpaceMember,
  SpaceMember,
  UpdatableSpaceMember,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { MemberInfo, UserPageRole } from './types';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { PageRepo } from './page.repo';

@Injectable()
export class PageMemberRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async insertPageMember(
    insertablePageMember: InsertablePageMember,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('pageMembers')
      .values(insertablePageMember)
      .returningAll()
      .execute();
  }

  /*
   * we want to get a user's role in a space.
   * they user can be a member either directly or via a group
   * we will pass the user id and space id to return the user's roles
   * if the user is a member of the space via multiple groups
   * if the user has no space permission it should return an empty array,
   * maybe we should throw an exception?
   */
  async getUserPageRoles(
    userId: string,
    pageId: string,
  ): Promise<UserPageRole[]> {
    const roles = await this.db
      .selectFrom('pageMembers')
      .select(['userId', 'role'])
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .unionAll(
        this.db
          .selectFrom('pageMembers')
          .innerJoin('groupUsers', 'groupUsers.groupId', 'pageMembers.groupId')
          .select(['groupUsers.userId', 'pageMembers.role'])
          .where('groupUsers.userId', '=', userId)
          .where('pageMembers.pageId', '=', pageId),
      )
      .execute();

    if (!roles || roles.length === 0) {
      return undefined;
    }
    return roles;
  }

  async getPageMembersPaginated(pageId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('pageMembers')
      .leftJoin('users', 'users.id', 'pageMembers.userId')
      .leftJoin('groups', 'groups.id', 'pageMembers.groupId')
      .select([
        'users.id as userId',
        'users.name as userName',
        'users.avatarUrl as userAvatarUrl',
        'users.email as userEmail',
        'groups.id as groupId',
        'groups.name as groupName',
        'groups.isDefault as groupIsDefault',
        'pageMembers.role',
        'pageMembers.createdAt',
      ])
      .select((eb) => this.groupRepo.withMemberCount(eb))
      .where('pageMembers.pageId', '=', pageId)
      .orderBy('pageMembers.createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb('users.name', 'ilike', `%${pagination.query}%`).or(
          'groups.name',
          'ilike',
          `%${pagination.query}%`,
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
}
