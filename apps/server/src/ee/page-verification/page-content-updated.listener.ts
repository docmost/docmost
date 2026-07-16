import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventName } from '../../common/events/event.contants';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { PageVerificationRepo } from './page-verification.repo';

export interface PageContentUpdatedEvent {
  pageId: string;
  spaceId: string;
  workspaceId: string;
  historyId: string;
}

@Injectable()
export class PageContentUpdatedListener {
  private readonly logger = new Logger(PageContentUpdatedListener.name);

  constructor(
    private readonly pageVerificationRepo: PageVerificationRepo,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  @OnEvent(EventName.PAGE_CONTENT_UPDATED)
  async handle(event: PageContentUpdatedEvent): Promise<void> {
    const previous = await this.pageVerificationRepo.findLatestByPageId(
      event.pageId,
    );
    if (
      !previous ||
      previous.type !== 'qms' ||
      previous.status !== 'approved'
    ) {
      return;
    }

    const verifiers = await this.pageVerificationRepo.getVerifiers(
      previous.id,
    );

    const created = await this.pageVerificationRepo.insert({
      pageId: event.pageId,
      workspaceId: event.workspaceId,
      spaceId: event.spaceId,
      type: 'qms',
      status: 'draft',
      pageHistoryId: event.historyId,
      creatorId: previous.creatorId,
    });

    if (verifiers.length > 0) {
      await this.pageVerificationRepo.replaceVerifiers(
        created.id,
        verifiers.map((v) => v.id),
        previous.creatorId,
      );
    }

    this.logger.debug(
      `Page ${event.pageId} content changed after approval; reset to draft (${created.id})`,
    );

    if (verifiers.length > 0) {
      await this.notificationQueue.add(
        QueueJob.PAGE_REVERIFICATION_REQUIRED_NOTIFICATION,
        {
          pageId: event.pageId,
          spaceId: event.spaceId,
          workspaceId: event.workspaceId,
          verifierIds: verifiers.map((v) => v.id),
        },
      );
    }
  }
}
