import { PageMemberRepo } from '@docmost/db/repos/page/page-memeber.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AddPageMembersDto } from '../dto/add-page-member.dto';
import { User } from '@docmost/db/types/entity.types';
import { InjectKysely } from 'nestjs-kysely';

@Injectable()
export class PageMemberService {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageMemberRepo: PageMemberRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async addUserToPage(
    userId: string,
    pageId: string,
    role: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await this.pageMemberRepo.insertPageMember(
      {
        userId: userId,
        pageId: pageId,
        role: role,
      },
      trx,
    );
  }

  async addMembersToPageBatch(
    dto: AddPageMembersDto,
    authUser: User,
    workspaceId: string,
  ): Promise<void> {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // make sure we have valid workspace users
    const validUsersQuery = this.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('users.id', 'in', dto.userIds)
      .where('users.workspaceId', '=', workspaceId)
      // using this because we can not use easily use onConflict with two unique indexes.
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('pageMembers')
              .select('id')
              .whereRef('pageMembers.userId', '=', 'users.id')
              .where('pageMembers.pageId', '=', dto.pageId),
          ),
        ),
      );

    const validGroupsQuery = this.db
      .selectFrom('groups')
      .select(['id', 'name'])
      .where('groups.id', 'in', dto.groupIds)
      .where('groups.workspaceId', '=', workspaceId)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('pageMembers')
              .select('id')
              .whereRef('pageMembers.groupId', '=', 'groups.id')
              .where('pageMembers.pageId', '=', dto.pageId),
          ),
        ),
      );

    let validUsers = [],
      validGroups = [];
    if (dto.userIds && dto.userIds.length > 0) {
      validUsers = await validUsersQuery.execute();
    }
    if (dto.groupIds && dto.groupIds.length > 0) {
      validGroups = await validGroupsQuery.execute();
    }

    const usersToAdd = [];
    for (const user of validUsers) {
      usersToAdd.push({
        pageId: dto.pageId,
        userId: user.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    const groupsToAdd = [];
    for (const group of validGroups) {
      groupsToAdd.push({
        pageId: dto.pageId,
        groupId: group.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    const membersToAdd = [...usersToAdd, ...groupsToAdd];

    if (membersToAdd.length > 0) {
      await this.pageMemberRepo.insertPageMember(membersToAdd);
    } else {
      // either they are already members or do not exist on the workspace
    }
  }
}
