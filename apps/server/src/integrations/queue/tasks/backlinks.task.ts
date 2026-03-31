import { Logger } from '@nestjs/common';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import { IPageBacklinkJob } from '../constants/queue.interface';
import { executeTx } from '@docmost/db/utils';

const logger = new Logger('BacklinksTask');

export async function processBacklinks(
  db: KyselyDB,
  backlinkRepo: BacklinkRepo,
  data: IPageBacklinkJob,
): Promise<void> {
  const { pageId, mentions, workspaceId } = data;

  await executeTx(db, async (trx) => {
    const existingBacklinks = await trx
      .selectFrom('backlinks')
      .select('targetPageId')
      .where('sourcePageId', '=', pageId)
      .execute();

    if (existingBacklinks.length === 0 && mentions.length === 0) {
      return;
    }

    const existingTargetPageIds = existingBacklinks.map(
      (backlink) => backlink.targetPageId,
    );

    const targetPageIds = mentions
      .filter((mention) => mention.entityId !== pageId)
      .map((mention) => mention.entityId);

    let validTargetPages = [];
    if (targetPageIds.length > 0) {
      validTargetPages = await trx
        .selectFrom('pages')
        .select('id')
        .where('id', 'in', targetPageIds)
        .where('workspaceId', '=', workspaceId)
        .execute();
    }

    const validTargetPageIds = validTargetPages.map((page) => page.id);

    const backlinksToAdd = validTargetPageIds.filter(
      (id) => !existingTargetPageIds.includes(id),
    );

    const backlinksToRemove = existingTargetPageIds.filter(
      (existingId) => !validTargetPageIds.includes(existingId),
    );

    if (backlinksToAdd.length > 0) {
      const newBacklinks = backlinksToAdd.map((targetPageId) => ({
        sourcePageId: pageId,
        targetPageId: targetPageId,
        workspaceId: workspaceId,
      }));

      await backlinkRepo.insertBacklink(newBacklinks, trx);
      logger.debug(
        `Added ${newBacklinks.length} new backlinks to ${pageId}`,
      );
    }

    if (backlinksToRemove.length > 0) {
      await db
        .deleteFrom('backlinks')
        .where('sourcePageId', '=', pageId)
        .where('targetPageId', 'in', backlinksToRemove)
        .execute();

      logger.debug(
        `Removed ${backlinksToRemove.length} outdated backlinks from ${pageId}.`,
      );
    }
  });
}
