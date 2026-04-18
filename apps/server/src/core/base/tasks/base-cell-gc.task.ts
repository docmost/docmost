import { Logger } from '@nestjs/common';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { IBaseCellGcJob } from '../../../integrations/queue/constants/queue.interface';

const logger = new Logger('BaseCellGcTask');

/*
 * Removes a soft-deleted property's key from every row in the base, then
 * hard-deletes the property record. Both operations run inside a single
 * transaction — without it, a failure between `removeCellKey` and
 * `hardDelete` leaves rows scrubbed while the property row lingers,
 * requiring manual cleanup. `removeCellKey` is a single
 * `UPDATE ... SET cells = cells - $propId` statement.
 */
export async function processBaseCellGc(
  db: KyselyDB,
  baseRowRepo: BaseRowRepo,
  basePropertyRepo: BasePropertyRepo,
  data: IBaseCellGcJob,
): Promise<void> {
  const { baseId, propertyId, workspaceId } = data;

  await executeTx(db, async (trx) => {
    await baseRowRepo.removeCellKey(baseId, propertyId, {
      workspaceId,
      trx,
    });
    await basePropertyRepo.hardDelete(propertyId, trx);
  });

  logger.log(`cell-gc complete base=${baseId} prop=${propertyId}`);
}
