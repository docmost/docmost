import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { GroupUserRepository } from '../respositories/group-user.repository';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
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
    await this.groupService.findAndValidateGroup(groupId, workspaceId);

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

  async addUserToDefaultGroup(
    userId: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<void> {
    return await transactionWrapper(
      async (manager) => {
        const defaultGroup = await this.groupService.getDefaultGroup(
          workspaceId,
          manager,
        );
        await this.addUserToGroup(
          userId,
          defaultGroup.id,
          workspaceId,
          manager,
        );
      },
      this.dataSource,
      manager,
    );
  }

  async addUserToGroup(
    userId: string,
    groupId: string,
    workspaceId: string,
    manager?: EntityManager,
  ): Promise<GroupUser> {
    return await transactionWrapper(
      async (manager) => {
        const group = await manager.findOneBy(Group, {
          id: groupId,
          workspaceId: workspaceId,
        });

        if (!group) {
          throw new NotFoundException('Group not found');
        }

        const find = await manager.findOne(User, {
          where: { id: userId },
        });

        console.log(find);

        const userExists = await manager.exists(User, {
          where: { id: userId, workspaceId },
        });

        if (!userExists) {
          throw new NotFoundException('User not found');
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

        return manager.save(groupUser);
      },
      this.dataSource,
      manager,
    );
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

    if (group.isDefault) {
      throw new BadRequestException(
        'You cannot remove users from a default group',
      );
    }

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
}
