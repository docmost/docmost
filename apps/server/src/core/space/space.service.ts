import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from './dto/create-space.dto';
import { Space } from './entities/space.entity';
import { SpaceRepository } from './repositories/space.repository';
import { SpaceUserRepository } from './repositories/space-user.repository';
import { SpaceUser } from './entities/space-user.entity';
import { transactionWrapper } from '../../helpers/db.helper';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { PaginationOptions } from '../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../helpers/pagination/paginated-result';
import { SpaceGroupRepository } from './repositories/space-group.repository';
import { Group } from '../group/entities/group.entity';
import { SpaceGroup } from './entities/space-group.entity';

@Injectable()
export class SpaceService {
  constructor(
    private spaceRepository: SpaceRepository,
    private spaceUserRepository: SpaceUserRepository,
    private spaceGroupRepository: SpaceGroupRepository,
    private dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    workspaceId: string,
    createSpaceDto?: CreateSpaceDto,
    manager?: EntityManager,
  ): Promise<Space> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const space = new Space();
        space.name = createSpaceDto.name ?? 'untitled space ';
        space.description = createSpaceDto.description ?? '';
        space.creatorId = userId;
        space.workspaceId = workspaceId;

        space.slug = space.name.toLowerCase(); // TODO: fix

        await manager.save(space);
        return space;
      },
      this.dataSource,
      manager,
    );
  }

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
    workspaceId,
    manager?: EntityManager,
  ): Promise<SpaceUser> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const userExists = await manager.exists(User, {
          where: { id: userId, workspaceId },
        });
        if (!userExists) {
          throw new NotFoundException('User not found');
        }

        const existingSpaceUser = await manager.findOneBy(SpaceUser, {
          userId: userId,
          spaceId: spaceId,
        });

        if (existingSpaceUser) {
          throw new BadRequestException('User already added to this space');
        }

        const spaceUser = new SpaceUser();
        spaceUser.userId = userId;
        spaceUser.spaceId = spaceId;
        spaceUser.role = role;
        await manager.save(spaceUser);

        return spaceUser;
      },
      this.dataSource,
      manager,
    );
  }

  async getSpaceInfo(spaceId: string, workspaceId: string): Promise<Space> {
    const space = await this.spaceRepository
      .createQueryBuilder('space')
      .where('space.id = :spaceId', { spaceId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'space.userCount',
        'space.spaceUsers',
        'spaceUsers',
      ) // TODO: add groups to userCount
      .getOne();

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return space;
  }

  async getWorkspaceSpaces(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Space>> {
    const [spaces, count] = await this.spaceRepository
      .createQueryBuilder('space')
      .where('space.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'space.userCount',
        'space.spaceUsers',
        'spaceUsers',
      ) // TODO: add groups to userCount
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(spaces, paginationMeta);
  }

  async getUserSpaces(
    userId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [userSpaces, count] = await this.spaceUserRepository
      .createQueryBuilder('spaceUser')
      .leftJoinAndSelect('spaceUser.space', 'space')
      .where('spaceUser.userId = :userId', { userId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'space.userCount',
        'space.spaceUsers',
        'spaceUsers',
      )
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();


    const getUserSpacesViaGroup = this.spaceRepository
      .createQueryBuilder('space')
      .leftJoin('space.spaceGroups', 'spaceGroup')
      .leftJoin('spaceGroup.group', 'group')
      .leftJoin('group.groupUsers', 'groupUser')
      .where('groupUser.userId = :userId', { userId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId }).getManyAndCount();

    console.log(await getUserSpacesViaGroup);

    const spaces = userSpaces.map((userSpace) => userSpace.space);

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(spaces, paginationMeta);
  }

  async getSpaceUsers(
    spaceId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [spaceUsers, count] = await this.spaceUserRepository.findAndCount({
      relations: ['user'],
      where: {
        space: {
          id: spaceId,
          workspaceId,
        },
      },
      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    const users = spaceUsers.map((spaceUser) => {
      delete spaceUser.user.password;
      return {
        ...spaceUser.user,
        spaceRole: spaceUser.role,
      };
    });

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(users, paginationMeta);
  }

  async addGroupToSpace(
    groupId: string,
    spaceId: string,
    role: string,
    workspaceId,
    manager?: EntityManager,
  ): Promise<SpaceGroup> {
    return await transactionWrapper(
      async (manager: EntityManager) => {
        const groupExists = await manager.exists(Group, {
          where: { id: groupId, workspaceId },
        });
        if (!groupExists) {
          throw new NotFoundException('Group not found');
        }

        const existingSpaceGroup = await manager.findOneBy(SpaceGroup, {
          groupId: groupId,
          spaceId: spaceId,
        });

        if (existingSpaceGroup) {
          throw new BadRequestException('Group already added to this space');
        }

        const spaceGroup = new SpaceGroup();
        spaceGroup.groupId = groupId;
        spaceGroup.spaceId = spaceId;
        spaceGroup.role = role;
        await manager.save(spaceGroup);

        return spaceGroup;
      },
      this.dataSource,
      manager,
    );
  }

  async getSpaceGroups(
    spaceId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [spaceGroups, count] = await this.spaceGroupRepository.findAndCount({
      relations: ['group'],
      where: {
        space: {
          id: spaceId,
          workspaceId,
        },
      },
      take: paginationOptions.limit,
      skip: paginationOptions.skip,
    });

    // TODO: add group userCount
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
