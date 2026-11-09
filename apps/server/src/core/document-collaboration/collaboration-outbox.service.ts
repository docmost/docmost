import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DocumentCollaborationRepo } from './document-collaboration.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import { UserRepo } from '../../database/repos/user/user.repo';
import { WsGateway } from '../../ws/ws.gateway';
import { Page } from '../../database/types/entity.types';

/** Retryable delivery. A notification outage never rolls back saved tasks or batches. */
@Injectable()
export class CollaborationOutboxService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(CollaborationOutboxService.name);
  constructor(
    private readonly repo: DocumentCollaborationRepo,
    private readonly access: PageAccessService,
    private readonly users: UserRepo,
    private readonly ws: WsGateway,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.flush(), 5000);
    this.timer.unref();
    void this.flush();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.repo.db
        .selectFrom('collaborationOutbox')
        .selectAll()
        .where('deliveredAt', 'is', null)
        .orderBy('id')
        .limit(100)
        .execute();
      for (const event of events) {
        try {
          const user = await this.users.findById(
            event.userId,
            event.workspaceId,
          );
          const page = await this.repo.db
            .selectFrom('pages')
            .selectAll()
            .where('id', '=', event.pageId)
            .executeTakeFirst();
          let deliver =
            !!user &&
            !user.deletedAt &&
            !user.deactivatedAt &&
            !!page &&
            !page.deletedAt &&
            page.workspaceId === event.workspaceId;
          if (deliver) {
            try {
              await this.access.validateCanView(page as Page, user, {
                skipCache: true,
              });
            } catch (error) {
              if (!(error instanceof ForbiddenException || error instanceof NotFoundException)) throw error;
              deliver = false;
            }
          }
          // Old assignment events must not notify a user after a reassignment or cancellation.
          if (deliver && event.type === 'document_task.assigned') {
            const task = await this.repo.db
              .selectFrom('documentTasks')
              .select(['assigneeId', 'status'])
              .where('id', '=', event.resourceId)
              .where('workspaceId', '=', event.workspaceId)
              .executeTakeFirst();
            deliver =
              task?.assigneeId === user.id && task?.status === 'pending';
          }
          if (deliver && event.type === 'reading_confirmation.requested') {
            const batch = await this.repo.db
              .selectFrom('readingBatches')
              .select('status')
              .where('id', '=', event.resourceId)
              .where('workspaceId', '=', event.workspaceId)
              .executeTakeFirst();
            deliver = batch?.status === 'open';
          }
          await this.repo.db.transaction().execute(async (trx) => {
            if (deliver)
              await trx
                .insertInto('notifications')
                .values({
                  id: event.id,
                  userId: event.userId,
                  workspaceId: event.workspaceId,
                  actorId: event.actorId,
                  pageId: event.pageId,
                  spaceId: page.spaceId,
                  type: event.type,
                  data: { resourceId: event.resourceId },
                })
                .onConflict((oc) => oc.column('id').doNothing())
                .execute();
            await trx
              .updateTable('collaborationOutbox')
              .set({ deliveredAt: new Date() })
              .where('id', '=', event.id)
              .execute();
          });
          if (deliver)
            this.ws.server
              ?.to(`user-${event.userId}`)
              .emit('notification', { id: event.id, type: event.type });
        } catch (error) {
          this.logger.warn(
            `Notification ${event.id} deferred: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Outbox retry deferred: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.running = false;
    }
  }
}
