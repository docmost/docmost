import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventName } from '../../common/events/event.contants';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { Queue } from 'bullmq';
import { EnvironmentService } from '../../integrations/environment/environment.service';

export class PageEvent {
  pageIds: string[];
}

@Injectable()
export class PageListener {
  private readonly logger = new Logger(PageListener.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectQueue(QueueName.SEARCH_QUEUE) private searchQueue: Queue,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: Queue,
  ) {}

  @OnEvent(EventName.PAGE_CREATED)
  async handlePageCreated(event: PageEvent) {
    const { pageIds } = event;
    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.PAGE_CREATED, { pageIds });
    }
    if (this.environmentService.isAISearchEnabled()) {
      await this.aiQueue.add(QueueJob.PAGE_CREATED, { pageIds });
    }
  }

  @OnEvent(EventName.PAGE_UPDATED)
  async handlePageUpdated(event: PageEvent) {
    const { pageIds } = event;

    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.PAGE_UPDATED, { pageIds });
    }
  }

  @OnEvent(EventName.PAGE_DELETED)
  async handlePageDeleted(event: PageEvent) {
    const { pageIds } = event;
    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.PAGE_DELETED, { pageIds });
    }

    await this.aiQueue.add(QueueJob.PAGE_DELETED, { pageIds });
  }

  @OnEvent(EventName.PAGE_SOFT_DELETED)
  async handlePageSoftDeleted(event: PageEvent) {
    const { pageIds } = event;

    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.PAGE_SOFT_DELETED, { pageIds });
    }

    await this.aiQueue.add(QueueJob.PAGE_SOFT_DELETED, { pageIds });
  }

  @OnEvent(EventName.PAGE_RESTORED)
  async handlePageRestored(event: PageEvent) {
    const { pageIds } = event;
    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.PAGE_RESTORED, { pageIds });
    }

    if (this.environmentService.isAISearchEnabled()) {
      await this.aiQueue.add(QueueJob.PAGE_RESTORED, { pageIds });
    }
  }

  isTypesense(): boolean {
    return this.environmentService.getSearchDriver() === 'typesense';
  }
}
