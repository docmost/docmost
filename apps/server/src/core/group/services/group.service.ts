import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto, DefaultGroup } from '../dto/create-group.dto';
import { GroupRepository } from '../respositories/group.repository';
import { Group } from '../entities/group.entity';
import { plainToInstance } from 'class-transformer';
import { User } from '../../user/entities/user.entity';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { DataSource, EntityManager } from 'typeorm';
import { transactionWrapper } from '../../../helpers/db.helper';

@Injectable()
export class GroupService {
  constructor(
    private groupRepository: GroupRepository,
    private dataSource: DataSource,
  ) {}

  async createGroup(
    authUser: User,
    workspaceId: string,
    createGroupDto: CreateGroupDto,
  ): Promise<Group> {
    const group = plainToInstance(Group, createGroupDto);
    group.creatorId = authUser.id;
    group.workspaceId = workspaceId;

    const groupExists = await this.findGroupByName(
      createGroupDto.name,
      workspaceId,
    );
    if (groupExists) {
      throw new BadRequestException('Group name already exists');
    }

    return await this.groupRepository.save(group);
  }

  async createDefaultGroup(
    workspaceId: string,
    userId?: string,
    manager?: EntityManager,
  ): Promise<Group> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const group = new Group();
        group.name = DefaultGroup.EVERYONE;
        group.isDefault = true;
        group.creatorId = userId ?? null;
        group.workspaceId = workspaceId;
        return await manager.save(group);
      },
      this.dataSource,
      manager,
    );
  }

  async getDefaultGroup(
    workspaceId: string,
    manager: EntityManager,
  ): Promise<Group> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        return await manager.findOneBy(Group, {
          isDefault: true,
          workspaceId,
        });
      },
      this.dataSource,
      manager,
    );
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

    if (group.isDefault) {
      throw new BadRequestException('You cannot update a default group');
    }

    const groupExists = await this.findGroupByName(
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

    return await this.groupRepository.save(group);
  }

  async getGroupInfo(groupId: string, workspaceId: string): Promise<Group> {
    const group = await this.groupRepository
      .createQueryBuilder('group')
      .where('group.id = :groupId', { groupId })
      .andWhere('group.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'group.memberCount',
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
        'group.memberCount',
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
    const group = await this.findAndValidateGroup(groupId, workspaceId);
    if (group.isDefault) {
      throw new BadRequestException('You cannot delete a default group');
    }
    await this.groupRepository.delete(groupId);
  }

  async findAndValidateGroup(
    groupId: string,
    workspaceId: string,
  ): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: {
        id: groupId,
        workspaceId: workspaceId,
      },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async findGroupByName(
    groupName: string,
    workspaceId: string,
  ): Promise<Group> {
    return this.groupRepository
      .createQueryBuilder('group')
      .where('LOWER(group.name) = LOWER(:groupName)', { groupName })
      .andWhere('group.workspaceId = :workspaceId', { workspaceId })
      .getOne();
  }
}
