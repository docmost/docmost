import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventName } from '../../common/events/event.contants';
import { PageEvent } from '../../database/listeners/page.listener';
import { CLOSE_REJOIN, E2eeRelayService } from './e2ee-relay.service';

/**
 * Ends live relay sessions when a page stops being something its current
 * members may keep streaming.
 *
 * Relay authorization is checked when a client joins, and again whenever its
 * collab token expires. These events cover the changes that should not wait
 * for that: a page that was deleted, or moved into a space whose membership is
 * different from the one the session was authorized against. Members reconnect
 * on their own, which re-runs the full check.
 */
@Injectable()
export class E2eePageListener {
  private readonly logger = new Logger(E2eePageListener.name);

  constructor(private readonly e2eeRelayService: E2eeRelayService) {}

  @OnEvent(EventName.PAGE_DELETED)
  @OnEvent(EventName.PAGE_SOFT_DELETED)
  async handlePageDeleted(event: PageEvent) {
    await this.closeRooms(event);
  }

  // the page is still encrypted: CLOSE_REJOIN makes members reconnect, which
  // re-runs the full authorization check against the new space's membership
  @OnEvent(EventName.PAGE_MOVED_TO_SPACE)
  async handlePageMovedToSpace(event: PageEvent) {
    await this.closeRooms(event, CLOSE_REJOIN);
  }

  private async closeRooms(event: PageEvent, code?: number) {
    await Promise.all(
      (event.pageIds ?? []).map((pageId) =>
        Promise.resolve(this.e2eeRelayService.closeRoom(pageId, code)).catch(
          (err) =>
            this.logger.warn(
              `Failed to close e2ee relay room for page ${pageId}`,
              err,
            ),
        ),
      ),
    );
  }
}
