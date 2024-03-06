import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { GroupUserRepository } from '../respositories/group-user.repository';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { WorkspaceUser } from '../../workspace/entities/workspace-user.entity';
import { transactionWrapper } from '../../../helpers/db.helper';
import { User } from '../../user/entities/user.entity';
import { GroupUser } from '../entities/group-user.entity';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { Group } from '../entities/group.entity';
import { GroupService } from './group.service';

@Injectable()
export class GroupUserService {
  constructor(
    private groupUserRepository: GroupUserRepository,
    private groupService: GroupService,
    private dataSource: DataSource,
  ) {}

  async getGroupUsers(
    groupId,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    await this.groupService.validateGroup(groupId, workspaceId);

    const [groupUsers, count] = await this.groupUserRepository.findAndCount({
      relations: ['user'],
      where: {
        groupId: groupId,
        group: {
          workspaceId: workspaceId,
        },
      },

      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    const users = groupUsers.map((groupUser: GroupUser) => groupUser.user);

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(users, paginationMeta);
  }

  async addUserToGroup(
    userId: string,
    groupId: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<WorkspaceUser> {
    let addedUser;

    await transactionWrapper(
      async (manager) => {
        const group = await manager.findOneBy(Group, {
          id: groupId,
          workspaceId: workspaceId,
        });

        if (!group) {
          throw new NotFoundException('Group not found');
        }

        const userExists = await manager.exists(User, {
          where: { id: userId },
        });
        if (!userExists) {
          throw new NotFoundException('User not found');
        }

        // only workspace users can be added to workspace groups
        const workspaceUser = await manager.findOneBy(WorkspaceUser, {
          userId: userId,
          workspaceId: workspaceId,
        });

        if (!workspaceUser) {
          throw new NotFoundException('User is not a member of this workspace');
        }

        const existingGroupUser = await manager.findOneBy(GroupUser, {
          userId: userId,
          groupId: groupId,
        });

        if (existingGroupUser) {
          throw new BadRequestException(
            'User is already a member of this group',
          );
        }

        const groupUser = new GroupUser();
        groupUser.userId = userId;
        groupUser.groupId = groupId;

        addedUser = await manager.save(groupUser);
      },
      this.dataSource,
      manager,
    );

    return addedUser;
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    const groupUser = await this.getGroupUser(userId, groupId);

    if (!groupUser) {
      throw new BadRequestException('Group member not found');
    }

    await this.groupUserRepository.delete({
      userId,
      groupId,
    });
  }

  async getGroupUser(userId: string, groupId: string): Promise<GroupUser> {
    return await this.groupUserRepository.findOneBy({
      userId,
      groupId,
    });
  }

  async getGroupUserCount(groupId: string): Promise<number> {
    return await this.groupUserRepository.count({
      where: {
        groupId: groupId,
      },
    });
  }
}
