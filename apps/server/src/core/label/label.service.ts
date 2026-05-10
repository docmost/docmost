import { Injectable, NotFoundException } from '@nestjs/common';
import { Label } from '@docmost/db/types/entity.types';
import { LabelRepo, LabelType } from '@docmost/db/repos/label/label.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { normalizeLabelName } from './utils';

@Injectable()
export class LabelService {
  constructor(
    private readonly labelRepo: LabelRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async addLabelsToPage(
    pageId: string,
    names: string[],
    workspaceId: string,
  ): Promise<Label[]> {
    const attached: Label[] = [];
    await executeTx(this.db, async (trx) => {
      for (const name of names) {
        const label = await this.labelRepo.findOrCreate(
          name.trim(),
          workspaceId,
          LabelType.PAGE,
          trx,
        );
        await this.labelRepo.addLabelToPage(pageId, label.id, trx);
        attached.push(label);
      }
    });
    return attached;
  }

  async removeLabelFromPage(
    pageId: string,
    labelId: string,
    workspaceId: string,
  ): Promise<void> {
    await executeTx(this.db, async (trx) => {
      const label = await this.labelRepo.findById(labelId, trx);
      if (!label || label.workspaceId !== workspaceId) {
        throw new NotFoundException('Label not found');
      }

      await this.labelRepo.removeLabelFromPage(
        pageId,
        labelId,
        workspaceId,
        trx,
      );

      const count = await this.labelRepo.getLabelPageCount(
        labelId,
        workspaceId,
        trx,
      );
      if (count === 0) {
        await this.labelRepo.deleteLabel(labelId, workspaceId, trx);
      }
    });
  }

  async getPageLabels(pageId: string, pagination: PaginationOptions) {
    return this.labelRepo.findLabelsByPageId(pageId, pagination);
  }

  async getLabels(
    workspaceId: string,
    userId: string,
    type: LabelType,
    pagination: PaginationOptions,
  ) {
    return this.labelRepo.findLabels(
      workspaceId,
      userId,
      type,
      pagination,
    );
  }

  async findPagesByLabel(
    labelId: string,
    userId: string,
    opts: {
      spaceId?: string;
      query?: string;
      pagination: PaginationOptions;
    },
  ) {
    const result = await this.labelRepo.findPagesByLabelId(labelId, userId, opts);
    if (result.items.length === 0) return result;

    const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: result.items.map((p) => p.id),
      userId,
      spaceId: opts.spaceId,
    });
    const accessible = new Set(accessibleIds);
    return {
      items: result.items.filter((p) => accessible.has(p.id)),
      meta: result.meta,
    };
  }

  async getLabelInfo(
    name: string,
    type: LabelType,
    workspaceId: string,
    userId: string,
    spaceId?: string,
  ) {
    const normalized = normalizeLabelName(name);
    const label = await this.labelRepo.findByNameAndWorkspace(
      normalized,
      workspaceId,
      type,
    );

    // Uniform response shape.
    // We don't want to expose whether the label row exists
    const usageCount = label
      ? await this.labelRepo.getLabelPageCountForUser(
          label.id,
          userId,
          spaceId,
        )
      : 0;

    return {
      name: normalized,
      usageCount,
    };
  }
}
