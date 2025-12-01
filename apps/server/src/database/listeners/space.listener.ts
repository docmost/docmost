import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventName } from '../../common/events/event.contants';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { Queue } from 'bullmq';
import { EnvironmentService } from '../../integrations/environment/environment.service';

export class SpaceEvent {
  spaceId: string;
}

@Injectable()
export class SpaceListener {
  private readonly logger = new Logger(SpaceListener.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectQueue(QueueName.SEARCH_QUEUE) private searchQueue: Queue,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: Queue,
  ) {}

  @OnEvent(EventName.SPACE_DELETED)
  async handleSpaceDeleted(event: SpaceEvent) {
    const { spaceId } = event;
    if (this.isTypesense()) {
      await this.searchQueue.add(QueueJob.SPACE_DELETED, { spaceId });
    }

    await this.aiQueue.add(QueueJob.SPACE_DELETED, { spaceId });
  }

  isTypesense(): boolean {
    return this.environmentService.getSearchDriver() === 'typesense';
  }
}
