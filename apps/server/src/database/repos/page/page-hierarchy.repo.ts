import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { sql } from 'kysely';
import { executeTx } from '../../utils';

export type IntegrityReport = {
  healthy: boolean;
  extraEntries: number;
  missingEntries: number;
  affectedSpaceIds: string[];
};

export type RepairResult = {
  rebuiltSpaces: number;
};

@Injectable()
export class PageHierarchyRepo {
  private readonly logger = new Logger(PageHierarchyRepo.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async tryAcquireGlobalLock(trx: KyselyTransaction): Promise<boolean> {
    const result = await sql<{ locked: boolean }>`
      SELECT pg_try_advisory_xact_lock(hashtext('rebuild_page_hierarchy_global')) as locked
    `.execute(trx);
    return result.rows[0]?.locked ?? false;
  }

  async tryAcquireSpaceLock(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<boolean> {
    const result = await sql<{ locked: boolean }>`
      SELECT pg_try_advisory_xact_lock(hashtext(${'rebuild_page_hierarchy_space_' + spaceId})) as locked
    `.execute(trx);
    return result.rows[0]?.locked ?? false;
  }

  async rebuildAll(trx: KyselyTransaction): Promise<number> {
    await trx.deleteFrom('pageHierarchy').execute();

    const result = await trx
      .withRecursive('pageTree', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'id as ancestorId',
            'id as descendantId',
            sql<number>`0`.as('depth'),
          ])
          .where('deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('pageTree as pt', 'p.parentPageId', 'pt.descendantId')
              .select([
                'pt.ancestorId',
                'p.id as descendantId',
                sql<number>`pt.depth + 1`.as('depth'),
              ])
              .where('p.deletedAt', 'is', null),
          ),
      )
      .insertInto('pageHierarchy')
      .columns(['ancestorId', 'descendantId', 'depth'])
      .expression((eb) =>
        eb
          .selectFrom('pageTree')
          .select(['ancestorId', 'descendantId', 'depth']),
      )
      .executeTakeFirst();

    return Number(result?.numInsertedOrUpdatedRows ?? 0);
  }

  async rebuildBySpace(
    spaceId: string,
    trx: KyselyTransaction,
  ): Promise<number> {
    await trx
      .deleteFrom('pageHierarchy')
      .where(
        'descendantId',
        'in',
        trx.selectFrom('pages').select('id').where('spaceId', '=', spaceId),
      )
      .execute();

    const result = await trx
      .withRecursive('pageTree', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'id as ancestorId',
            'id as descendantId',
            sql<number>`0`.as('depth'),
          ])
          .where('spaceId', '=', spaceId)
          .where('deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('pageTree as pt', 'p.parentPageId', 'pt.descendantId')
              .select([
                'pt.ancestorId',
                'p.id as descendantId',
                sql<number>`pt.depth + 1`.as('depth'),
              ])
              .where('p.spaceId', '=', spaceId)
              .where('p.deletedAt', 'is', null),
          ),
      )
      .insertInto('pageHierarchy')
      .columns(['ancestorId', 'descendantId', 'depth'])
      .expression((eb) =>
        eb
          .selectFrom('pageTree')
          .select(['ancestorId', 'descendantId', 'depth']),
      )
      .executeTakeFirst();

    return Number(result?.numInsertedOrUpdatedRows ?? 0);
  }

  async checkIntegrity(): Promise<IntegrityReport> {
    const result = await this.db
      .withRecursive('expected', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'id as ancestorId',
            'id as descendantId',
            sql<number>`0`.as('depth'),
            'spaceId',
          ])
          .where('deletedAt', 'is', null)
          .unionAll((eb) =>
            eb
              .selectFrom('pages as p')
              .innerJoin('expected as e', 'p.parentPageId', 'e.descendantId')
              .select([
                'e.ancestorId',
                'p.id as descendantId',
                sql<number>`e.depth + 1`.as('depth'),
                'p.spaceId',
              ])
              .where('p.deletedAt', 'is', null),
          ),
      )
      .selectFrom('expected as e')
      .fullJoin('pageHierarchy as ph', (join) =>
        join
          .onRef('e.ancestorId', '=', 'ph.ancestorId')
          .onRef('e.descendantId', '=', 'ph.descendantId'),
      )
      .leftJoin('pages as p', 'ph.descendantId', 'p.id')
      .select([
        sql<number>`count(*) filter (where e.ancestor_id is null and ph.ancestor_id is not null)`.as(
          'extraCount',
        ),
        sql<number>`count(*) filter (where ph.ancestor_id is null and e.ancestor_id is not null)`.as(
          'missingCount',
        ),
        sql<
          string[]
        >`array_agg(distinct coalesce(e.space_id, p.space_id)) filter (where
          (e.ancestor_id is null and ph.ancestor_id is not null) or
          (ph.ancestor_id is null and e.ancestor_id is not null)
        )`.as('affectedSpaceIds'),
      ])
      .executeTakeFirst();

    const extraCount = Number(result?.extraCount ?? 0);
    const missingCount = Number(result?.missingCount ?? 0);
    const affectedSpaceIds = (result?.affectedSpaceIds ?? []).filter(Boolean);

    return {
      healthy: extraCount === 0 && missingCount === 0,
      extraEntries: extraCount,
      missingEntries: missingCount,
      affectedSpaceIds,
    };
  }

  async repair(): Promise<RepairResult> {
    const report = await this.checkIntegrity();

    if (report.healthy) {
      return { rebuiltSpaces: 0 };
    }

    let rebuiltSpaces = 0;

    for (const spaceId of report.affectedSpaceIds) {
      await executeTx(this.db, async (trx) => {
        const locked = await this.tryAcquireSpaceLock(spaceId, trx);
        if (!locked) {
          this.logger.debug(
            `Repair for space ${spaceId} skipped - another process holds the lock`,
          );
          return;
        }

        await this.rebuildBySpace(spaceId, trx);
        rebuiltSpaces++;
      });
    }

    return { rebuiltSpaces };
  }
}
