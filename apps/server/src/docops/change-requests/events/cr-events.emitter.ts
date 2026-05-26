import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CrTransitionEvent {
  crId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  serviceId: string;
  pageId: string;
  reason?: string | null;
}

export interface CrPublishedEvent extends CrTransitionEvent {
  publishedVersionId: string;
}

@Injectable()
export class CrEventsEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitTransition(event: CrTransitionEvent): void {
    this.eventEmitter.emit(`cr.${event.action}`, event);
    this.eventEmitter.emit('cr.transition', event);
  }

  emitPublished(event: CrPublishedEvent): void {
    this.eventEmitter.emit('cr.published', event);
    this.eventEmitter.emit('cr.transition', event);
  }
}
