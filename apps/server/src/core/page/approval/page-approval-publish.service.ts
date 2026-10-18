import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Page, User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageDraftRepo } from '@docmost/db/repos/page/page-draft.repo';
import { PageHistoryRepo } from '@docmost/db/repos/page/page-history.repo';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { IPageUpdateNotificationJob } from '../../../integrations/queue/constants/queue.interface';
import { TransclusionService } from '../transclusion/transclusion.service';
import { WsService } from '../../../ws/ws.service';
import { buildAddTreeNodeEvent } from '../../../ws/ws.utils';
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
  mergeContributorIds,
} from './page-approval-publish.utils';

@Injectable()
export class PageApprovalPublishService {
  private readonly logger = new Logger(PageApprovalPublishService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageDraftRepo: PageDraftRepo,
    private readonly pageHistoryRepo: PageHistoryRepo,
    private readonly attachmentRepo: AttachmentRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageApprovalService: PageApprovalService,
    private readonly transclusionService: TransclusionService,
    private readonly wsService: WsService,
    private readonly collaborationGateway: CollaborationGateway,
    @InjectQueue(QueueName.AI_QUEUE) private readonly aiQueue: Queue,
    @InjectQueue(QueueName.GENERAL_QUEUE) private readonly generalQueue: Queue,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  // The caller has validated the approval state inside the same transaction.
  async publishSnapshot(
    input: { page: Page; historyId: string; approverId: string },
    trx: KyselyTransaction,
  ): Promise<{ version: number; content: any }> {
    const { page, historyId, approverId } = input;

    const lockedPage = await this.pageRepo.findById(page.id, {
      withLock: true,
      trx,
    });
    const snapshot = await this.pageHistoryRepo.findById(historyId, {
      includeContent: true,
      trx,
    });
    if (
      !lockedPage ||
      !snapshot ||
      snapshot.pageId !== page.id ||
      snapshot.kind !== 'draft'
    ) {
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
        lastUpdatedById: snapshot.lastUpdatedById ?? undefined,
        contributorIds: mergeContributorIds(
          lockedPage.contributorIds,
          snapshot.contributorIds,
        ),
        readerVersionId: historyId,
      },
      page.id,
      trx,
    );

    await this.attachmentRepo.markPublishedForPage(
      page.workspaceId,
      page.id,
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
    const page = await this.pageRepo.findById(pageId, {
      withLock: true,
      trx,
    });
    const draft = await this.pageDraftRepo.findByPageId(pageId, { trx });

    if (draft) {
      await this.pageDraftRepo.copyBackToPage(pageId, trx);
      // copyBackToPage leaves the draft's editors behind.
      await this.pageRepo.updatePage(
        {
          lastUpdatedById: draft.lastUpdatedById ?? undefined,
          contributorIds: mergeContributorIds(
            page?.contributorIds,
            draft.contributorIds,
          ),
        },
        pageId,
        trx,
      );
    }
    await this.attachmentRepo.markAllPublishedForPage(pageId, trx);
    if (!opts?.keepReaderVersion) {
      await this.pageRepo.clearReaderVersion(pageId, trx);
    }

    const published = await this.pageRepo.findById(pageId, {
      includeContent: true,
      trx,
    });
    return { content: published?.content ?? null };
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

    // First, so editors of an approved draft get write access back right away.
    await this.attempt(page.id, 'reset collaboration connections', () =>
      this.collaborationGateway.handleYjsEvent(
        'resetConnections',
        `page.${page.id}`,
        undefined,
        true,
      ),
    );
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
  }

  // Readers get no draft events, so these tell them about the publish.
  private async emitPublishEvents(
    pageId: string,
    firstPublish: boolean,
  ): Promise<void> {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) return;

    const viewersOf = (userIds: string[]) =>
      this.pagePermissionRepo.getUserIdsWithPageAccess(page.id, userIds);

    await this.wsService.emitToSpaceUsers(
      page.spaceId,
      buildTreeUpdateEvent(page),
      viewersOf,
    );
    await this.wsService.emitToSpaceUsers(
      page.spaceId,
      buildApprovalPublishedEvent(page),
      viewersOf,
    );
    if (!firstPublish) return;

    // Draft users already list the page; a repeat addTreeNode duplicates it.
    await this.wsService.emitToSpaceUsers(
      page.spaceId,
      buildAddTreeNodeEvent(page),
      async (userIds) => {
        const viewerIds = await viewersOf(userIds);
        const draftUserIds = new Set(
          await this.pageApprovalService.getUserIdsWithDraftAccess(
            page,
            viewerIds,
          ),
        );
        return viewerIds.filter((userId) => !draftUserIds.has(userId));
      },
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
