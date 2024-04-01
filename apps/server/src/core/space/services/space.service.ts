import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { PaginationOptions } from '../../../kysely/pagination/pagination-options';
import slugify from 'slugify';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Space } from '@docmost/db/types/entity.types';
import { PaginationResult } from '@docmost/db/pagination/pagination';

@Injectable()
export class SpaceService {
  constructor(private spaceRepo: SpaceRepo) {}

  async create(
    userId: string,
    workspaceId: string,
    createSpaceDto: CreateSpaceDto,
    trx?: KyselyTransaction,
  ): Promise<Space> {
    const slug = slugify(
      createSpaceDto?.slug?.toLowerCase() ?? createSpaceDto.name.toLowerCase(),
    );

    const slugExists = await this.spaceRepo.slugExists(slug, workspaceId, trx);
    if (slugExists) {
      throw new BadRequestException(
        'Slug exist. Please use a unique space slug',
      );
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
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return space;
  }

  async getWorkspaceSpaces(
    workspaceId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Space>> {
    const spaces = await this.spaceRepo.getSpacesInWorkspace(
      workspaceId,
      pagination,
    );

    return spaces;
  }
}
