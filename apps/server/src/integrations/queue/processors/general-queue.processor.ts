import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { WorkspaceService } from '../../../core/workspace/services/workspace.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { isUserDisabled } from '../../../common/helpers';
import { UserRole } from '../../../common/helpers/types/permission';
import { QueueJob, QueueName } from '../constants';
import {
  IAddPageWatchersJob,
  IPageBacklinkJob,
} from '../constants/queue.interface';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';
import {
  WatcherRepo,
  WatcherType,
} from '@docmost/db/repos/watcher/watcher.repo';
import { InsertableWatcher } from '@docmost/db/types/entity.types';
import { processBacklinks } from '../tasks/backlinks.task';

@Processor(QueueName.GENERAL_QUEUE)
export class GeneralQueueProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(GeneralQueueProcessor.name);
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly backlinkRepo: BacklinkRepo,
    private readonly watcherRepo: WatcherRepo,
    private readonly userRepo: UserRepo,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
        case QueueJob.APPLY_IMPORTED_USER_STATUS: {
          // Offboard in the application process, which owns the live sockets,
          // collaboration access checks and audit service.
          const { workspaceId, importerId, userId, state } = job.data;
          const actor = await this.userRepo.findById(importerId, workspaceId);
          const user = await this.userRepo.findById(userId, workspaceId);
          if (!actor || !user)
            throw new Error(
              'Import account or workspace member could not be found',
            );
          if (
            isUserDisabled(actor) ||
            (actor.role !== UserRole.OWNER && actor.role !== UserRole.ADMIN)
          ) {
            throw new Error(
              'The account running the import must be an active workspace administrator',
            );
          }
          if (user.deletedAt || (state === 'deactivated' && user.deactivatedAt))
            break;
          const workspace = this.moduleRef.get(WorkspaceService, {
            strict: false,
          });
          if (state === 'deleted') {
            await workspace.deleteUser(actor, userId, workspaceId, {
              preserveEmail: true,
            });
          } else if (state === 'deactivated') {
            await workspace.deactivateUser(actor, userId, workspaceId);
          }
          break;
        }
        case QueueJob.ADD_PAGE_WATCHERS: {
          const { userIds, pageId, spaceId, workspaceId } =
            job.data as IAddPageWatchersJob;
          const watchers: InsertableWatcher[] = userIds.map((userId) => ({
            userId,
            pageId,
            spaceId,
            workspaceId,
            type: WatcherType.PAGE,
            addedById: userId,
          }));
          await this.watcherRepo.insertMany(watchers);
          break;
        }

        case QueueJob.PAGE_BACKLINKS: {
          await processBacklinks(
            this.db,
            this.backlinkRepo,
            job.data as IPageBacklinkJob,
          );
          break;
        }
      }
    } catch (err) {
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} job`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Completed ${job.name} job`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
