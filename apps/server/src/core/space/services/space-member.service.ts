import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceRepository } from '../repositories/space.repository';
import { transactionWrapper } from '../../../helpers/db.helper';
import { DataSource, EntityManager, IsNull, Not } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { Group } from '../../group/entities/group.entity';
import { SpaceMemberRepository } from '../repositories/space-member.repository';
import { SpaceMember } from '../entities/space-member.entity';

@Injectable()
export class SpaceMemberService {
  constructor(
    private spaceRepository: SpaceRepository,
    private spaceMemberRepository: SpaceMemberRepository,
    private dataSource: DataSource,
  ) {}

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
    workspaceId,
    manager?: EntityManager,
  ): Promise<SpaceMember> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const userExists = await manager.exists(User, {
          where: { id: userId, workspaceId },
        });
        if (!userExists) {
          throw new NotFoundException('User not found');
        }

        const existingSpaceUser = await manager.findOneBy(SpaceMember, {
          userId: userId,
          spaceId: spaceId,
        });

        if (existingSpaceUser) {
          throw new BadRequestException('User already added to this space');
        }

        const spaceMember = new SpaceMember();
        spaceMember.userId = userId;
        spaceMember.spaceId = spaceId;
        spaceMember.role = role;
        await manager.save(spaceMember);

        return spaceMember;
      },
      this.dataSource,
      manager,
    );
  }

  async getUserSpaces(
    userId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [userSpaces, count] = await this.spaceMemberRepository
      .createQueryBuilder('spaceMember')
      .leftJoinAndSelect('spaceMember.space', 'space')
      .where('spaceMember.userId = :userId', { userId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'space.memberCount',
        'space.spaceMembers',
        'spaceMembers',
      )
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();

    /*
    const getUserSpacesViaGroup = this.spaceRepository
      .createQueryBuilder('space')
      .leftJoin('space.spaceGroups', 'spaceGroup')
      .leftJoin('spaceGroup.group', 'group')
      .leftJoin('group.groupUsers', 'groupUser')
      .where('groupUser.userId = :userId', { userId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .getManyAndCount();

       console.log(await getUserSpacesViaGroup);
*/

    const spaces = userSpaces.map((userSpace) => userSpace.space);

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(spaces, paginationMeta);
  }

  async getSpaceMembers(
    spaceId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [spaceMembers, count] = await this.spaceMemberRepository.findAndCount(
      {
        relations: ['user', 'group'],
        where: {
          space: {
            id: spaceId,
            workspaceId,
          },
        },
        order: {
          createdAt: 'ASC',
        },
        take: paginationOptions.limit,
        skip: paginationOptions.skip,
      },
    );

    const members = await Promise.all(
      spaceMembers.map(async (member) => {
        let memberInfo = {};

        if (member.user) {
          memberInfo = {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            avatarUrl: member.user.avatarUrl,
            type: 'user',
          };
        } else if (member.group) {
          const memberCount = await this.dataSource.getRepository(Group).count({
            where: {
              id: member.groupId,
              workspaceId,
            },
          });

          memberInfo = {
            id: member.group.id,
            name: member.group.name,
            isDefault: member.group.isDefault,
            memberCount: memberCount,
            type: 'group',
          };
        }

        return {
          ...memberInfo,
          role: member.role,
        };
      }),
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(members, paginationMeta);
  }

  async addGroupToSpace(
    groupId: string,
    spaceId: string,
    role: string,
    workspaceId,
    manager?: EntityManager,
  ): Promise<SpaceMember> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const groupExists = await manager.exists(Group, {
          where: { id: groupId, workspaceId },
        });
        if (!groupExists) {
          throw new NotFoundException('Group not found');
        }

        const existingSpaceGroup = await manager.findOneBy(SpaceMember, {
          groupId: groupId,
          spaceId: spaceId,
        });

        if (existingSpaceGroup) {
          throw new BadRequestException('Group already added to this space');
        }

        const spaceMember = new SpaceMember();
        spaceMember.groupId = groupId;
        spaceMember.spaceId = spaceId;
        spaceMember.role = role;
        await manager.save(spaceMember);

        return spaceMember;
      },
      this.dataSource,
      manager,
    );
  }

  async getSpaceGroup(
    spaceId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [spaceGroups, count] = await this.spaceMemberRepository.findAndCount({
      relations: ['group'],
      where: {
        groupId: Not(IsNull()),
        space: {
          id: spaceId,
          workspaceId,
        },
      },
      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    // TODO: add group memberCount
    const groups = spaceGroups.map((spaceGroup) => {
      return {
        ...spaceGroup.group,
        spaceRole: spaceGroup.role,
      };
    });

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(groups, paginationMeta);
  }
}
