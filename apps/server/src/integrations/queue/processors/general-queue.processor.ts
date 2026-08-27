import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../constants';
import {
  IAddPageWatchersJob,
  IGoogleGroupSyncJob,
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
import { processGoogleGroupSync } from '../tasks/google-group-sync.task';
import { ModuleRef } from '@nestjs/core';
import { AuthProviderRepo } from '@docmost/db/repos/auth-provider/auth-provider.repo';
import { AuthProviderGroupMappingRepo } from '@docmost/db/repos/auth-provider/auth-provider-group-mapping.repo';
import { GoogleGroupsService } from '../../../core/auth/sso/services/google-groups.service';
import { GoogleProvisioningService } from '../../../core/auth/sso/services/google-provisioning.service';

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
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly mappingRepo: AuthProviderGroupMappingRepo,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    try {
      switch (job.name) {
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

        case QueueJob.GOOGLE_GROUP_SYNC: {
          // Resolved lazily: this processor lives in a global module, so
          // injecting the SSO services would be circular.
          await processGoogleGroupSync(
            {
              authProviderRepo: this.authProviderRepo,
              mappingRepo: this.mappingRepo,
              googleGroupsService: this.moduleRef.get(GoogleGroupsService, {
                strict: false,
              }),
              provisioningService: this.moduleRef.get(
                GoogleProvisioningService,
                { strict: false },
              ),
            },
            job.data as IGoogleGroupSyncJob,
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
