import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { CreateBaseDto } from '../dto/create-base.dto';
import { UpdateBaseDto } from '../dto/update-base.dto';
import { BasePropertyType } from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@Injectable()
export class BaseService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRepo: BaseRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseViewRepo: BaseViewRepo,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateBaseDto) {
    return executeTx(this.db, async (trx) => {
      const base = await this.baseRepo.insertBase(
        {
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          pageId: dto.pageId,
          spaceId: dto.spaceId,
          workspaceId,
          creatorId: userId,
        },
        trx,
      );

      const firstPosition = generateJitteredKeyBetween(null, null);

      await this.basePropertyRepo.insertProperty(
        {
          baseId: base.id,
          name: 'Title',
          type: BasePropertyType.TEXT,
          position: firstPosition,
          isPrimary: true,
          workspaceId,
        },
        trx,
      );

      await this.baseViewRepo.insertView(
        {
          baseId: base.id,
          name: 'Table View 1',
          type: 'table',
          position: firstPosition,
          workspaceId,
          creatorId: userId,
        },
        trx,
      );

      return this.baseRepo.findById(base.id, {
        includeProperties: true,
        includeViews: true,
        trx,
      });
    });
  }

  async getBaseInfo(baseId: string) {
    const base = await this.baseRepo.findById(baseId, {
      includeProperties: true,
      includeViews: true,
    });

    if (!base) {
      throw new NotFoundException('Base not found');
    }

    return base;
  }

  async update(dto: UpdateBaseDto) {
    const base = await this.baseRepo.findById(dto.baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.baseRepo.updateBase(dto.baseId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
    });

    return this.baseRepo.findById(dto.baseId);
  }

  async delete(baseId: string) {
    const base = await this.baseRepo.findById(baseId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.baseRepo.softDelete(baseId);
  }

  async listBySpaceId(spaceId: string, pagination: PaginationOptions) {
    return this.baseRepo.findBySpaceId(spaceId, pagination);
  }
}
