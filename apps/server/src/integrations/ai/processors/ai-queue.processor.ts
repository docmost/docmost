import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../queue/constants';
import { AiIndexingService } from '../ai-indexing.service';

interface AiJobData {
  pageIds?: string[];
  pageId?: string;
  workspaceId?: string;
}

@Processor(QueueName.AI_QUEUE)
export class AiQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(AiQueueProcessor.name);

  constructor(private readonly indexingService: AiIndexingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data = (job.data ?? {}) as AiJobData;
    const pageIds = data.pageIds ?? (data.pageId ? [data.pageId] : []);

    try {
      switch (job.name) {
        case QueueJob.PAGE_CREATED:
        case QueueJob.PAGE_CONTENT_UPDATED:
        case QueueJob.PAGE_RESTORED:
        case QueueJob.PAGE_MOVED_TO_SPACE:
        case QueueJob.GENERATE_PAGE_EMBEDDINGS: {
          if (data.workspaceId) {
            await this.indexingService.embedPages(pageIds, data.workspaceId);
          }
          break;
        }
        case QueueJob.PAGE_DELETED:
        case QueueJob.PAGE_SOFT_DELETED:
        case QueueJob.DELETE_PAGE_EMBEDDINGS: {
          await this.indexingService.deletePages(pageIds);
          break;
        }
        case QueueJob.WORKSPACE_CREATE_EMBEDDINGS: {
          if (data.workspaceId) {
            await this.indexingService.backfillWorkspace(data.workspaceId);
          }
          break;
        }
        case QueueJob.WORKSPACE_DELETE_EMBEDDINGS:
        case QueueJob.WORKSPACE_DELETED: {
          if (data.workspaceId) {
            await this.indexingService.deleteWorkspace(data.workspaceId);
          }
          break;
        }
        default:
          // not an embedding-related job; ignore
          break;
      }
    } catch (err) {
      this.logger.error(
        `AI queue job "${job.name}" failed: ${(err as Error)?.message}`,
      );
      throw err;
    }
  }
}
