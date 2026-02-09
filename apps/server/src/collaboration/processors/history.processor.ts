import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { IPageHistoryJob } from '../../integrations/queue/constants/queue.interface';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { isDeepStrictEqual } from 'node:util';

@Processor(QueueName.HISTORY_QUEUE)
export class HistoryProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(HistoryProcessor.name);

  constructor(
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly pageRepo: PageRepo,
  ) {
    super();
  }

  async process(job: Job<IPageHistoryJob, void>): Promise<void> {
    if (job.name !== QueueJob.PAGE_HISTORY) return;

    try {
      const { pageId } = job.data;

      const page = await this.pageRepo.findById(pageId, {
        includeContent: true,
      });

      if (!page) {
        this.logger.warn(`Page ${pageId} not found, skipping history`);
        return;
      }

      const lastHistory = await this.pageHistoryRepo.findPageLastHistory(
        pageId,
        { includeContent: true },
      );

      if (
        !lastHistory ||
        !isDeepStrictEqual(lastHistory.content, page.content)
      ) {
        await this.pageHistoryRepo.saveHistory(page);
        this.logger.debug(`History created for page: ${pageId}`);
      }
    } catch (err) {
      throw err;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing ${job.name} for page: ${job.data.pageId}`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Failed ${job.name} for page: ${job.data.pageId}. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
