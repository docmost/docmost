import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGroupDto } from '../dto/create-group.dto';
import { GroupRepository } from '../respositories/group.repository';
import { Group } from '../entities/group.entity';
import { plainToInstance } from 'class-transformer';
import { User } from '../../user/entities/user.entity';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { UpdateGroupDto } from '../dto/update-group.dto';

@Injectable()
export class GroupService {
  constructor(private groupRepository: GroupRepository) {}

  async createGroup(
    authUser: User,
    workspaceId: string,
    createGroupDto: CreateGroupDto,
  ): Promise<Group> {
    const group = plainToInstance(Group, createGroupDto);
    group.creatorId = authUser.id;
    group.workspaceId = workspaceId;

    return await this.groupRepository.save(group);
  }

  async updateGroup(
    workspaceId: string,
    updateGroupDto: UpdateGroupDto,
  ): Promise<Group> {
    const group = new Group();

    if (updateGroupDto.name) {
      group.name = updateGroupDto.name;
    }

    if (updateGroupDto.description) {
      group.description = updateGroupDto.description;
    }

    return await this.groupRepository.save(group);
  }

  async getGroup(groupId: string, workspaceId: string): Promise<Group> {
    const group = await this.groupRepository.findOneBy({
      id: groupId,
      workspaceId: workspaceId,
    });

    //TODO: get group member count

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async getGroupsInWorkspace(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Group>> {
    const [groupsInWorkspace, count] = await this.groupRepository.findAndCount({
      where: {
        workspaceId: workspaceId,
      },

      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(groupsInWorkspace, paginationMeta);
  }

  async deleteGroup(groupId: string, workspaceId: string) {
    await this.getGroup(groupId, workspaceId);
    await this.groupRepository.delete(groupId);
  }
}
