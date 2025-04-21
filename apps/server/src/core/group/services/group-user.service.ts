import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { GroupService } from './group.service';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Injectable()
export class GroupUserService {
  constructor(
    private groupUserRepo: GroupUserRepo,
    private userRepo: UserRepo,
    @Inject(forwardRef(() => GroupService))
    private groupService: GroupService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async getGroupUsers(
    groupId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    await this.groupService.findAndValidateGroup(groupId, workspaceId);

    const groupUsers = await this.groupUserRepo.getGroupUsersPaginated(
      groupId,
      pagination,
    );

    return groupUsers;
  }

  async addUsersToGroupBatch(
    userIds: string[],
    groupId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.groupService.findAndValidateGroup(groupId, workspaceId);

    // make sure we have valid workspace users
    const validUsers = await this.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('users.id', 'in', userIds)
      .where('users.workspaceId', '=', workspaceId)
      .execute();

    // prepare users to add to group
    const groupUsersToInsert = [];
    for (const user of validUsers) {
      groupUsersToInsert.push({
        userId: user.id,
        groupId: groupId,
      });
    }

    // batch insert new group users
    await this.db
      .insertInto('groupUsers')
      .values(groupUsersToInsert)
      .onConflict((oc) => oc.columns(['userId', 'groupId']).doNothing())
      .execute();
  }

  async removeUserFromGroup(
    userId: string,
    groupId: string,
    workspaceId: string,
  ): Promise<void> {
    const group = await this.groupService.findAndValidateGroup(
      groupId,
      workspaceId,
    );

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (group.isDefault) {
      throw new BadRequestException(
        'You cannot remove users from a default group',
      );
    }

    const groupUser = await this.groupUserRepo.getGroupUserById(
      userId,
      groupId,
    );

    if (!groupUser) {
      throw new BadRequestException('Group member not found');
    }

    await this.groupUserRepo.delete(userId, groupId);
  }
}
