import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Space } from '@docmost/db/types/entity.types';
import { PaginationResult } from '@docmost/db/pagination/pagination';
import { UpdateSpaceDto } from '../dto/update-space.dto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { slugify } = require('fix-esm').require('@sindresorhus/slugify');

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

  async updateSpace(
    updateSpaceDto: UpdateSpaceDto,
    workspaceId: string,
  ): Promise<Space> {
    if (!updateSpaceDto.name && !updateSpaceDto.description) {
      throw new BadRequestException('Please provide fields to update');
    }

    return await this.spaceRepo.updateSpace(
      {
        name: updateSpaceDto.name,
        description: updateSpaceDto.description,
      },
      updateSpaceDto.spaceId,
      workspaceId,
    );
  }

  async getSpaceInfo(spaceId: string, workspaceId: string): Promise<Space> {
    const space = await this.spaceRepo.findById(spaceId, workspaceId, {
      includeMemberCount: true,
    });
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
