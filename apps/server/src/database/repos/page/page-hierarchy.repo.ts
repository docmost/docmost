import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { sql } from 'kysely';

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
}
