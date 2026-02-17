import { Injectable } from '@nestjs/common';
import { LabelRepo, LabelType } from '@docmost/db/repos/label/label.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { Label } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';

@Injectable()
export class LabelService {
  constructor(
    private readonly labelRepo: LabelRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async addLabelsToPage(
    pageId: string,
    names: string[],
    workspaceId: string,
  ): Promise<Label[]> {
    await executeTx(this.db, async (trx) => {
      for (const name of names) {
        const label = await this.labelRepo.findOrCreate(
          name.trim(),
          workspaceId,
          LabelType.PAGE,
          trx,
        );
        await this.labelRepo.addLabelToPage(pageId, label.id, trx);
      }
    });

    return this.labelRepo.findLabelsByPageId(pageId);
  }

  async removeLabelFromPage(
    pageId: string,
    labelId: string,
  ): Promise<void> {
    await executeTx(this.db, async (trx) => {
      await this.labelRepo.removeLabelFromPage(pageId, labelId, trx);

      const count = await this.labelRepo.getLabelPageCount(labelId, trx);
      if (count === 0) {
        await this.labelRepo.deleteLabel(labelId, trx);
      }
    });
  }

  async getPageLabels(pageId: string): Promise<Label[]> {
    return this.labelRepo.findLabelsByPageId(pageId);
  }

  async searchPagesByLabel(
    labelId: string,
    userId: string,
    opts?: { spaceId?: string },
  ) {
    return this.labelRepo.findPagesByLabelId(labelId, userId, opts);
  }

  async cleanupOrphanedLabels(pageIds: string[]): Promise<void> {
    const labelIds = await this.labelRepo.findLabelIdsByPageIds(pageIds);
    if (labelIds.length === 0) return;
    await this.labelRepo.deleteOrphanedLabels(labelIds);
  }
}
