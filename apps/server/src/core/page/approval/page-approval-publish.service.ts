import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Page, User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageDraftRepo } from '@docmost/db/repos/page/page-draft.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { IPageUpdateNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { TransclusionService } from '../transclusion/transclusion.service';
import { WsService } from '../../../ws/ws.service';
import { WsTreeService } from '../../../ws/ws-tree.service';
import { CollaborationGateway } from '../../../collaboration/collaboration.gateway';
import { jsonToText } from '../../../collaboration/collaboration.util';
import { getProsemirrorContent } from '../../../common/helpers/prosemirror/utils';
import { PageApprovalService } from './page-approval.service';
import {
  DRAFT_RESET_FAILED_MESSAGE,
  PAGE_NOT_CONTROLLED_MESSAGE,
  SUBMISSION_NOT_PENDING_MESSAGE,
  attachmentIdsOf,
  buildApprovalPublishedEvent,
  buildBacklinkJob,
  buildTreeUpdateEvent,
  draftOverridesMatch,
  matchesResetContent,
} from './page-approval-publish.utils';

@Injectable()
export class PageApprovalPublishService {
  private readonly logger = new Logger(PageApprovalPublishService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageDraftRepo: PageDraftRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageApprovalService: PageApprovalService,
    private readonly transclusionService: TransclusionService,
    private readonly wsService: WsService,
    private readonly wsTreeService: WsTreeService,
    private readonly collaborationGateway: CollaborationGateway,
    @InjectQueue(QueueName.AI_QUEUE) private readonly aiQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private readonly generalQueue: Queue,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  // The caller holds the page row lock and has validated the approval state.
  async publishSnapshot(
    input: { page: Page; historyId: string; approverId: string },
    trx: KyselyTransaction,
  ): Promise<{ version: number; content: any }> {
    const { page, historyId, approverId } = input;

    const snapshot = await this.pageHistoryRepo.findById(historyId, {
      includeContent: true,
      trx,
    });
    if (!snapshot || snapshot.pageId !== page.id || snapshot.kind !== 'draft') {
      throw new ConflictException(SUBMISSION_NOT_PENDING_MESSAGE);
    }

    const content = snapshot.content as any;
    const version = await this.pageHistoryRepo.nextApprovedVersion(
      page.id,
      trx,
    );
    await this.pageHistoryRepo.markApproved(
      historyId,
      { version, approvedById: approverId, approvedAt: new Date() },
      trx,
    );

    await this.pageRepo.updatePage(
      {
        content,
        textContent: this.toTextContent(page.id, content),
        title: snapshot.title,
        icon: snapshot.icon,
        readerVersionId: historyId,
      },
      page.id,
      trx,
    );

    await this.attachmentRepo.markPublished(
      page.workspaceId,
      attachmentIdsOf(content),
      trx,
    );

    const draft = await this.pageDraftRepo.findByPageId(page.id, { trx });
    if (draft && draftOverridesMatch(draft, snapshot)) {
      await this.pageDraftRepo.clearTitleIcon(page.id, trx);
    }

    return { version, content };
  }

  // Ends approval control: the draft, with its Yjs history, becomes the page.
  async publishDraftToPage(
    pageId: string,
    trx: KyselyTransaction,
    opts?: { keepReaderVersion?: boolean },
  ): Promise<{ content: any }> {
    await this.pageRepo.findById(pageId, { withLock: true, trx });

    await this.pageDraftRepo.copyBackToPage(pageId, trx);
    await this.attachmentRepo.markAllPublishedForPage(pageId, trx);
    await this.pageRepo.updatePage(
      opts?.keepReaderVersion ? {} : { readerVersionId: null },
      pageId,
      trx,
    );

    const page = await this.pageRepo.findById(pageId, {
      includeContent: true,
      trx,
    });
    return { content: page?.content ?? null };
  }

  // Never inside a page-locking transaction: the collab store takes that lock.
  async discardDraftToReaderVersion(page: Page, actor: User): Promise<void> {
    const state = await this.pageApprovalService.getState(page);
    if (!state.controlled) {
      throw new ConflictException(PAGE_NOT_CONTROLLED_MESSAGE);
    }

    const readerVersion = await this.pageHistoryRepo.findLatestReaderVersion(
      page.id,
      { includeContent: true },
    );
    const content = getProsemirrorContent(readerVersion?.content ?? null);

    try {
      await this.collaborationGateway.handleYjsEvent(
        'updatePageContent',
        `page.${page.id}`,
        {
          operation: 'replace',
          prosemirrorJson: content,
          user: actor,
          force: true,
        },
      );
    } catch (err) {
      this.logger.error({ err, pageId: page.id }, 'Failed to reset the draft');
      throw new ConflictException(DRAFT_RESET_FAILED_MESSAGE);
    }

    // A failed store is only logged, so the stored draft is the proof.
    const draft = await this.pageDraftRepo.findByPageId(page.id, {
      includeContent: true,
    });
    if (!draft || !matchesResetContent(draft.content, content)) {
      throw new ConflictException(DRAFT_RESET_FAILED_MESSAGE);
    }

    await this.pageDraftRepo.clearTitleIcon(page.id);
    await this.attachmentRepo.softDeleteUnpublished(page.id);
  }

  // Post-commit; a failing step must not stop the others.
  async runPostPublish(input: {
    page: Page;
    content: any;
    actorId: string;
    notifyWatchers: boolean;
    firstPublish?: boolean;
  }): Promise<void> {
    const { page, content, actorId, notifyWatchers, firstPublish } = input;

    await this.attempt(page.id, 'queue the AI update', () =>
      this.aiQueue.add(QueueJob.PAGE_CONTENT_UPDATED, {
        pageIds: [page.id],
        workspaceId: page.workspaceId,
      }),
    );
    await this.attempt(page.id, 'sync transclusions', () =>
      this.transclusionService.syncPageTransclusions(
        page.id,
        page.workspaceId,
        content,
      ),
    );
    await this.attempt(page.id, 'sync transclusion references', () =>
      this.transclusionService.syncPageReferences(
        page.id,
        page.workspaceId,
        content,
      ),
    );
    await this.attempt(page.id, 'queue backlinks', () =>
      this.generalQueue.add(
        QueueJob.PAGE_BACKLINKS,
        buildBacklinkJob(page, content),
      ),
    );
    if (notifyWatchers) {
      await this.attempt(page.id, 'queue the watcher notification', () =>
        this.notificationQueue.add(QueueJob.PAGE_UPDATED, {
          pageId: page.id,
          spaceId: page.spaceId,
          workspaceId: page.workspaceId,
          actorIds: [actorId],
        } as IPageUpdateNotificationJob),
      );
    }
    await this.attempt(page.id, 'send publish events', () =>
      this.emitPublishEvents(page.id, firstPublish === true),
    );
    await this.attempt(page.id, 'reset collaboration connections', () =>
      this.collaborationGateway.handleYjsEvent(
        'resetConnections',
        `page.${page.id}`,
        undefined,
        true,
      ),
    );
  }

  // Readers get no draft events, so these tell them about the publish.
  private async emitPublishEvents(
    pageId: string,
    firstPublish: boolean,
  ): Promise<void> {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) return;

    const memberIds = await this.spaceMemberRepo.getSpaceMemberUserIds(
      page.spaceId,
    );
    const userIds = await this.pagePermissionRepo.getUserIdsWithPageAccess(
      page.id,
      memberIds,
    );
    if (userIds.length === 0) return;

    await this.wsService.emitToUsers(userIds, buildTreeUpdateEvent(page));
    await this.wsService.emitToUsers(
      userIds,
      buildApprovalPublishedEvent(page),
    );
    if (!firstPublish) return;

    // Draft users already list the page; a repeat addTreeNode duplicates it.
    const draftUserIds = new Set(
      await this.pageApprovalService.getUserIdsWithDraftAccess(page, userIds),
    );
    await this.wsTreeService.notifyPermissionGranted(
      page,
      userIds.filter((userId) => !draftUserIds.has(userId)),
    );
  }

  private toTextContent(pageId: string, content: any): string | null {
    if (!content) return null;
    try {
      return jsonToText(content);
    } catch (err) {
      this.logger.warn(
        `jsonToText failed for page ${pageId}: ${err?.['message']}`,
      );
      return null;
    }
  }

  private async attempt(
    pageId: string,
    step: string,
    fn: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error({ err, pageId }, `Failed to ${step} after publishing`);
    }
  }
}
