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
    const group = await this.groupRepository.findOneBy({
      id: updateGroupDto.groupId,
      workspaceId: workspaceId,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (updateGroupDto.name) {
      group.name = updateGroupDto.name;
    }

    if (updateGroupDto.description) {
      group.description = updateGroupDto.description;
    }

    return await this.groupRepository.save(group);
  }

  async getGroupInfo(groupId: string, workspaceId: string): Promise<Group> {
    const group = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.id = :groupId', { groupId })
      .andWhere('group.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'group.userCount',
        'group.groupUsers',
        'groupUsers',
      )
      .getOne();

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async getWorkspaceGroups(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Group>> {
    const [groups, count] = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'group.userCount',
        'group.groupUsers',
        'groupUsers',
      )
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(groups, paginationMeta);
  }

  async deleteGroup(groupId: string, workspaceId: string): Promise<void> {
    await this.validateGroup(groupId, workspaceId);
    await this.groupRepository.delete(groupId);
  }

  async validateGroup(groupId: string, workspaceId: string): Promise<void> {
    const groupExists = await this.groupRepository.exists({
      where: {
        id: groupId,
        workspaceId: workspaceId,
      },
    });
    if (!groupExists) {
      throw new NotFoundException('Group not found');
    }
  }
}
