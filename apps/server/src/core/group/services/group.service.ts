import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto, DefaultGroup } from '../dto/create-group.dto';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { Group, InsertableGroup, User } from '@docmost/db/types/entity.types';

@Injectable()
export class GroupService {
  constructor(private groupRepo: GroupRepo) {}

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

    return await this.groupRepo.insertGroup(insertableGroup, trx);
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
    );

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.isDefault) {
      throw new BadRequestException('You cannot update a default group');
    }

    const groupExists = await this.groupRepo.findByName(
      updateGroupDto.name,
      workspaceId,
    );
    if (groupExists) {
      throw new BadRequestException('Group name already exists');
    }

    if (updateGroupDto.name) {
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

  async getGroupInfo(groupId: string, workspaceId: string): Promise<Group> {
    // todo: add member count
    const group = await this.groupRepo.findById(groupId, workspaceId);

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async getWorkspaceGroups(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Group>> {
    const { groups, count } = await this.groupRepo.getGroupsPaginated(
      workspaceId,
      paginationOptions,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(groups, paginationMeta);
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
