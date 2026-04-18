import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { BasePropertyRepo } from '@docmost/db/repos/base/base-property.repo';
import { BaseRepo } from '@docmost/db/repos/base/base.repo';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import {
  IBaseCellGcJob,
  IBaseTypeConversionJob,
} from '../../../integrations/queue/constants/queue.interface';
import { processBaseTypeConversion } from '../tasks/base-type-conversion.task';
import { processBaseCellGc } from '../tasks/base-cell-gc.task';
import { EventName } from '../../../common/events/event.contants';
import {
  BasePropertyUpdatedEvent,
  BaseSchemaBumpedEvent,
} from '../events/base-events';

@Processor(QueueName.BASE_QUEUE)
export class BaseQueueProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(BaseQueueProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly baseRowRepo: BaseRowRepo,
    private readonly basePropertyRepo: BasePropertyRepo,
    private readonly baseRepo: BaseRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case QueueJob.BASE_TYPE_CONVERSION: {
        const data = job.data as IBaseTypeConversionJob;
        // Cell rewrite + pending→live swap + schema_version bump share one
        // transaction so readers never see cells already in the new format
        // under a still-pending type (or vice versa).
        const { summary, schemaVersion } = await executeTx(
          this.db,
          async (trx) => {
            const s = await processBaseTypeConversion(
              this.db,
              this.baseRowRepo,
              data,
              {
                trx,
                progress: (processed) => job.updateProgress({ processed }),
              },
            );
            await this.basePropertyRepo.commitPendingTypeChange(
              data.propertyId,
              trx,
            );
            await this.basePropertyRepo.bumpSchemaVersion(data.propertyId, trx);
            const v = await this.baseRepo.bumpSchemaVersion(data.baseId, trx);
            return { summary: s, schemaVersion: v };
          },
        );

        // Emit the property:updated first so clients drop the "Converting…"
        // badge and repaint headers with the new type, then schema:bumped
        // so they invalidate row caches to pick up migrated cells.
        const updated = await this.basePropertyRepo.findById(data.propertyId);
        if (updated) {
          const event: BasePropertyUpdatedEvent = {
            baseId: data.baseId,
            workspaceId: data.workspaceId,
            actorId: data.actorId ?? null,
            requestId: null,
            property: updated,
            schemaVersion: updated.schemaVersion,
          };
          this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, event);
        }
        this.emitSchemaBumped(
          data.baseId,
          data.workspaceId,
          schemaVersion,
          data.actorId,
        );
        return summary;
      }
      case QueueJob.BASE_CELL_GC: {
        const data = job.data as IBaseCellGcJob;
        await processBaseCellGc(
          this.db,
          this.baseRowRepo,
          this.basePropertyRepo,
          data,
        );
        const schemaVersion = await this.baseRepo.bumpSchemaVersion(
          data.baseId,
        );
        this.emitSchemaBumped(data.baseId, data.workspaceId, schemaVersion);
        return;
      }
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private emitSchemaBumped(
    baseId: string,
    workspaceId: string,
    schemaVersion: number,
    actorId?: string,
  ): void {
    const event: BaseSchemaBumpedEvent = {
      baseId,
      workspaceId,
      actorId: actorId ?? null,
      requestId: null,
      schemaVersion,
    };
    this.eventEmitter.emit(EventName.BASE_SCHEMA_BUMPED, event);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job ${job.id}`);
  }

  @OnWorkerEvent('failed')
  async onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job ${job.id}. Reason: ${job.failedReason}`,
    );

    // Clean up a stuck conversion so the column doesn't wedge in
    // "Converting…" forever. Cells remain under the original type because
    // the rewrite transaction rolled back.
    if (job.name === QueueJob.BASE_TYPE_CONVERSION) {
      const data = job.data as IBaseTypeConversionJob;
      try {
        await this.basePropertyRepo.clearPendingTypeChange(data.propertyId);
        const reverted = await this.basePropertyRepo.findById(data.propertyId);
        if (reverted) {
          const event: BasePropertyUpdatedEvent = {
            baseId: data.baseId,
            workspaceId: data.workspaceId,
            actorId: data.actorId ?? null,
            requestId: null,
            property: reverted,
            schemaVersion: reverted.schemaVersion,
          };
          this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, event);
        }
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to clear pending type change on property ${data.propertyId}`,
          cleanupErr as Error,
        );
      }
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Completed ${job.name} job ${job.id}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
