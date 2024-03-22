import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { Space } from '../entities/space.entity';
import { SpaceRepository } from '../repositories/space.repository';
import { transactionWrapper } from '../../../helpers/db.helper';
import { DataSource, EntityManager } from 'typeorm';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { SpaceMemberRepository } from '../repositories/space-member.repository';
import slugify from 'slugify';

@Injectable()
export class SpaceService {
  constructor(
    private spaceRepository: SpaceRepository,
    private spaceMemberRepository: SpaceMemberRepository,
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

        space.slug = slugify(space.name.toLowerCase()); // TODO: check for duplicate

        await manager.save(space);
        return space;
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
        'space.memberCount',
        'space.spaceMembers',
        'spaceMembers',
      ) // TODO: add groups to memberCount
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
        'space.memberCount',
        'space.spaceMembers',
        'spaceMembers',
      ) // TODO: add groups to memberCount
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(spaces, paginationMeta);
  }
}
