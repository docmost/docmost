import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto, DefaultGroup } from '../dto/create-group.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { Group, InsertableGroup, User } from '@docmost/db/types/entity.types';
import { PaginationResult } from '@docmost/db/pagination/pagination';
import { GroupUserService } from './group-user.service';

@Injectable()
export class GroupService {
  constructor(
    private groupRepo: GroupRepo,
    @Inject(forwardRef(() => GroupUserService))
    private groupUserService: GroupUserService,
  ) {}

  async getGroupInfo(groupId: string, workspaceId: string): Promise<Group> {
    const group = await this.groupRepo.findById(groupId, workspaceId, {
      includeMemberCount: true,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async createGroup(
    authUser: User,
    workspaceId: string,
    createGroupDto: CreateGroupDto,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const groupExists = await this.groupRepo.findByName(
      createGroupDto.name,
      workspaceId,
    );
    if (groupExists) {
      throw new BadRequestException('Group name already exists');
    }
    const insertableGroup: InsertableGroup = {
      name: createGroupDto.name,
      description: createGroupDto.description,
      isDefault: false,
      creatorId: authUser.id,
      workspaceId: workspaceId,
    };

    const createdGroup = await this.groupRepo.insertGroup(insertableGroup, trx);

    if (createGroupDto?.userIds && createGroupDto.userIds.length > 0) {
      await this.groupUserService.addUsersToGroupBatch(
        createGroupDto.userIds,
        createdGroup.id,
        workspaceId,
      );
    }

    return createdGroup;
  }

  async createDefaultGroup(
    workspaceId: string,
    userId?: string,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const insertableGroup: InsertableGroup = {
      name: DefaultGroup.EVERYONE,
      isDefault: true,
      creatorId: userId ?? null,
      workspaceId: workspaceId,
    };
    return await this.groupRepo.insertGroup(insertableGroup, trx);
  }

  async updateGroup(
    workspaceId: string,
    updateGroupDto: UpdateGroupDto,
  ): Promise<Group> {
    const group = await this.groupRepo.findById(
      updateGroupDto.groupId,
      workspaceId,
      { includeMemberCount: true },
    );

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.isDefault) {
      throw new BadRequestException('You cannot update a default group');
    }

    if (updateGroupDto.name) {
      const existingGroup = await this.groupRepo.findByName(
        updateGroupDto.name,
        workspaceId,
      );

      if (existingGroup && group.name !== existingGroup.name) {
        throw new BadRequestException('Group name already exists');
      }

      group.name = updateGroupDto.name;
    }

    if (updateGroupDto.description) {
      group.description = updateGroupDto.description;
    }

    await this.groupRepo.update(
      {
        name: updateGroupDto.name,
        description: updateGroupDto.description,
      },
      group.id,
      workspaceId,
    );

    return group;
  }

  async getWorkspaceGroups(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginationResult<Group>> {
    const groups = await this.groupRepo.getGroupsPaginated(
      workspaceId,
      paginationOptions,
    );
    return groups;
  }

  async deleteGroup(groupId: string, workspaceId: string): Promise<void> {
    const group = await this.findAndValidateGroup(groupId, workspaceId);
    if (group.isDefault) {
      throw new BadRequestException('You cannot delete a default group');
    }
    await this.groupRepo.delete(groupId, workspaceId);
  }

  async findAndValidateGroup(
    groupId: string,
    workspaceId: string,
  ): Promise<Group> {
    const group = await this.groupRepo.findById(groupId, workspaceId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }
}
