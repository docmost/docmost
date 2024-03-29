import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import slugify from 'slugify';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { getRandomInt } from '../../../helpers/utils';
import { Space } from '@docmost/db/types/entity.types';

@Injectable()
export class SpaceService {
  constructor(private spaceRepo: SpaceRepo) {}

  async create(
    userId: string,
    workspaceId: string,
    createSpaceDto: CreateSpaceDto,
    trx?: KyselyTransaction,
  ): Promise<Space> {
    // until we allow slug in dto
    let slug = slugify(createSpaceDto.name.toLowerCase());
    const slugExists = await this.spaceRepo.slugExists(slug, workspaceId);
    if (slugExists) {
      slug = `${slug}-${getRandomInt()}`;
    }

    return await this.spaceRepo.insertSpace(
      {
        name: createSpaceDto.name ?? 'untitled space',
        description: createSpaceDto.description ?? '',
        creatorId: userId,
        workspaceId: workspaceId,
        slug: slug,
      },
      trx,
    );
  }

  async getSpaceInfo(spaceId: string, workspaceId: string): Promise<Space> {
    // TODO: add memberCount
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return space;
  }

  async getWorkspaceSpaces(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<Space>> {
    const { spaces, count } = await this.spaceRepo.getSpacesInWorkspace(
      workspaceId,
      paginationOptions,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(spaces, paginationMeta);
  }
}
