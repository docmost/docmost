import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { Label } from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { sql } from 'kysely';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Injectable()
export class LabelRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async findById(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<Label | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('labels')
      .selectAll()
      .where('id', '=', labelId)
      .executeTakeFirst();
  }

  async findByNameAndWorkspace(
    name: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Label | undefined> {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('labels')
      .selectAll()
      .where(sql`LOWER(name)`, '=', name.toLowerCase())
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
  }

  async findOrCreate(
    name: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Label> {
    const db = dbOrTx(this.db, trx);
    const trimmedName = name.trim();

    const result = await db
      .insertInto('labels')
      .values({ name: trimmedName, workspaceId })
      .onConflict((oc) =>
        oc
          .expression(sql`workspace_id, LOWER(name)`)
          .doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (result) {
      return result;
    }

    return this.findByNameAndWorkspace(trimmedName, workspaceId, trx);
  }

  async findLabelsByPageId(pageId: string): Promise<Label[]> {
    return this.db
      .selectFrom('labels')
      .innerJoin('pageLabels', 'pageLabels.labelId', 'labels.id')
      .select(['labels.id', 'labels.name', 'labels.createdAt', 'labels.updatedAt', 'labels.workspaceId'])
      .where('pageLabels.pageId', '=', pageId)
      .orderBy('labels.name', 'asc')
      .execute();
  }

  async addLabelToPage(
    pageId: string,
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .insertInto('pageLabels')
      .values({ pageId, labelId })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  async removeLabelFromPage(
    pageId: string,
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('pageLabels')
      .where('pageId', '=', pageId)
      .where('labelId', '=', labelId)
      .execute();
  }

  async getLabelPageCount(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);
    const result = await db
      .selectFrom('pageLabels')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('labelId', '=', labelId)
      .executeTakeFirst();

    return Number(result?.count ?? 0);
  }

  async deleteLabel(
    labelId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .deleteFrom('labels')
      .where('id', '=', labelId)
      .execute();
  }

  async deleteOrphanedLabels(
    labelIds: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (labelIds.length === 0) return;
    const db = dbOrTx(this.db, trx);

    const labelsWithPages = await db
      .selectFrom('pageLabels')
      .select('labelId')
      .where('labelId', 'in', labelIds)
      .groupBy('labelId')
      .execute();

    const labelsStillInUse = new Set(labelsWithPages.map((r) => r.labelId));
    const orphanedIds = labelIds.filter((id) => !labelsStillInUse.has(id));

    if (orphanedIds.length > 0) {
      await db
        .deleteFrom('labels')
        .where('id', 'in', orphanedIds)
        .execute();
    }
  }

  async findPagesByLabelId(
    labelId: string,
    userId: string,
    opts?: { spaceId?: string },
  ) {
    let query = this.db
      .selectFrom('pages')
      .innerJoin('pageLabels', 'pageLabels.pageId', 'pages.id')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'pages.createdAt',
        'pages.updatedAt',
      ])
      .where('pageLabels.labelId', '=', labelId)
      .where('pages.deletedAt', 'is', null);

    if (opts?.spaceId) {
      query = query.where('pages.spaceId', '=', opts.spaceId);
    } else {
      query = query.where(
        'pages.spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(userId),
      );
    }

    return query.orderBy('pages.updatedAt', 'desc').execute();
  }

  async findLabelIdsByPageIds(
    pageIds: string[],
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    if (pageIds.length === 0) return [];
    const db = dbOrTx(this.db, trx);
    const results = await db
      .selectFrom('pageLabels')
      .select('labelId')
      .where('pageId', 'in', pageIds)
      .groupBy('labelId')
      .execute();

    return results.map((r) => r.labelId);
  }
}
