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
import { PageService } from '../../page/services/page.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
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
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateBaseDto) {
    return executeTx(this.db, async (trx) => {
      const page = await this.pageService.create(
        userId,
        workspaceId,
        {
          title: dto.name ?? 'Untitled',
          icon: dto.icon,
          spaceId: dto.spaceId,
          parentPageId: dto.parentPageId,
          isBase: true,
        } as any,
        trx,
      );

      const firstPosition = generateJitteredKeyBetween(null, null);

      await this.basePropertyRepo.insertProperty(
        {
          pageId: page.id,
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
          pageId: page.id,
          name: 'Table',
          type: 'table',
          position: firstPosition,
          config: {},
          workspaceId,
          creatorId: userId,
        },
        { trx },
      );

      return this.baseRepo.findById(page.id, {
        includeProperties: true,
        includeViews: true,
        trx,
      });
    });
  }

  async getBaseInfo(pageId: string) {
    const base = await this.baseRepo.findById(pageId, {
      includeProperties: true,
      includeViews: true,
    });

    if (!base) {
      throw new NotFoundException('Base not found');
    }

    return base;
  }

  async update(dto: UpdateBaseDto) {
    const base = await this.baseRepo.findById(dto.pageId);
    if (!base) {
      throw new NotFoundException('Base not found');
    }

    await this.pageRepo.updatePage(
      {
        ...(dto.name !== undefined && { title: dto.name }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
      dto.pageId,
    );

    return this.baseRepo.findById(dto.pageId);
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
