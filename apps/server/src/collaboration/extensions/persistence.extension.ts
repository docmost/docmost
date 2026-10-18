import {
  afterUnloadDocumentPayload,
  beforeHandleAwarenessPayload,
  Document,
  Extension,
  onChangePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server';
import { Forbidden } from '@hocuspocus/common';
import * as Y from 'yjs';
import { Injectable, Logger } from '@nestjs/common';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  getPageId,
  isRenderableObject,
  jsonToText,
  tiptapExtensions,
} from '../collaboration.util';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageDraftRepo } from '@docmost/db/repos/page/page-draft.repo';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { Queue } from 'bullmq';
import {
  extractMentions,
  extractUserMentions,
} from '../../common/helpers/prosemirror/utils';
import { isDeepStrictEqual } from 'node:util';
import {
  IPageHistoryJob,
  IPageMentionNotificationJob,
} from '../../integrations/queue/constants/queue.interface';
import { Page, PageDraft } from '@docmost/db/types/entity.types';
import { CollabHistoryService } from '../services/collab-history.service';
import {
  HISTORY_FAST_INTERVAL,
  HISTORY_FAST_THRESHOLD,
  HISTORY_INTERVAL,
} from '../constants';
import { TransclusionService } from '../../core/page/transclusion/transclusion.service';
import { PageApprovalService } from '../../core/page/approval/page-approval.service';
import { ApprovalState } from '../../core/page/approval/page-approval.types';

type YdocSource = Pick<Page, 'content' | 'ydoc'>;

type DraftStore = {
  page: Page;
  state: ApprovalState;
  changed: boolean;
  previousContent: unknown;
};

@Injectable()
export class PersistenceExtension implements Extension {
  private readonly logger = new Logger(PersistenceExtension.name);
  private contributors: Map<string, Set<string>> = new Map();

  constructor(
    private readonly pageRepo: PageRepo,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.AI_QUEUE) private aiQueue: Queue,
    @InjectQueue(QueueName.HISTORY_QUEUE) private historyQueue: Queue,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE) private notificationQueue: Queue,
    private readonly collabHistory: CollabHistoryService,
    private readonly transclusionService: TransclusionService,
    private readonly pageDraftRepo: PageDraftRepo,
    private readonly pageApprovalService: PageApprovalService,
  ) {}

  async onLoadDocument(data: onLoadDocumentPayload) {
    const { documentName, document } = data;
    const pageId = getPageId(documentName);

    if (!document.isEmpty('default')) {
      return;
    }

    const page = await this.pageRepo.findById(pageId, {
      includeContent: true,
      includeYdoc: true,
    });

    if (!page) {
      this.logger.warn('page not found');
      return;
    }

    const source = await this.findLoadSource(page);

    if (source.ydoc) {
      this.logger.debug(`ydoc loaded from db: ${pageId}`);

      const doc = new Y.Doc();
      const dbState = new Uint8Array(source.ydoc);

      Y.applyUpdate(doc, dbState);
      return doc;
    }

    // if no ydoc state in db convert json in page.content to Ydoc.
    if (source.content) {
      this.logger.debug(`converting json to ydoc: ${pageId}`);

      const ydoc = TiptapTransformer.toYdoc(
        source.content,
        'default',
        tiptapExtensions,
      );

      Y.encodeStateAsUpdate(ydoc);
      return ydoc;
    }

    this.logger.debug(`creating fresh ydoc: ${pageId}`);
    return new Y.Doc();
  }

  async onStoreDocument(data: onStoreDocumentPayload) {
    const { documentName, document, lastContext } = data;

    const pageId = getPageId(documentName);

    const tiptapJson = TiptapTransformer.fromYdoc(document, 'default');
    const ydocState = Buffer.from(Y.encodeStateAsUpdate(document));

    let textContent = null;

    try {
      textContent = jsonToText(tiptapJson);
    } catch (err) {
      this.logger.warn('jsonToText' + err?.['message']);
    }

    let page: Page = null;
    let draftStore: DraftStore = null;
    const editingUserIds = this.consumeContributors(documentName);
    // direct connections such as freezeDraft carry no user
    const lastUserId: string | undefined = lastContext?.user?.id;

    try {
      await executeTx(this.db, async (trx) => {
        page = await this.pageRepo.findById(pageId, {
          withLock: true,
          includeContent: true,
          trx,
        });

        if (!page) {
          this.logger.error(`Page with id ${pageId} not found`);
          return;
        }

        const state = await this.pageApprovalService.getState(page, trx);
        const draft = await this.pageDraftRepo.findByPageId(pageId, {
          includeContent: true,
          trx,
        });

        // a draft left on an uncontrolled page goes back to the page, then the live document overwrites it
        const healed = !!draft && !state.controlled;
        if (healed) {
          await this.pageDraftRepo.copyBackToPage(pageId, trx);
        } else if (draft || state.controlled) {
          draftStore = await this.storeDraft(
            {
              page,
              state,
              draft,
              tiptapJson,
              ydocState,
              lastUserId,
              editingUserIds,
            },
            trx,
          );
          page = null;
          return;
        }

        if (!healed && isDeepStrictEqual(tiptapJson, page.content)) {
          page = null;
          return;
        }

        let contributorIds = undefined;
        try {
          const existingContributors = page.contributorIds || [];
          contributorIds = Array.from(
            new Set([
              ...existingContributors,
              ...editingUserIds,
              page.creatorId,
            ]),
          );
        } catch (err) {
          //this.logger.debug('Contributors error:' + err?.['message']);
        }

        await this.pageRepo.updatePage(
          {
            content: tiptapJson,
            textContent: textContent,
            ydoc: ydocState,
            lastUpdatedById: lastUserId,
            contributorIds: contributorIds,
          },
          pageId,
          trx,
        );

        this.logger.debug(`Page updated: ${pageId} - SlugId: ${page.slugId}`);
      });
    } catch (err) {
      this.logger.error(`Failed to update page ${pageId}`, err);
      page = null;
      draftStore = null;
      editingUserIds.forEach((userId) =>
        this.trackContributor(documentName, userId),
      );
    }

    if (draftStore) {
      await this.closeConnectionsWithoutDraftAccess(
        document,
        draftStore.page,
        draftStore.state,
      );

      if (draftStore.changed) {
        await this.afterContentStored(
          document,
          lastContext,
          draftStore.page,
          editingUserIds,
        );
        await this.queueMentionNotifications(
          draftStore.page,
          tiptapJson,
          draftStore.previousContent,
          true,
        );
        await this.enqueuePageHistory(draftStore.page);
      }
      return;
    }

    if (page) {
      await this.afterContentStored(document, lastContext, page, editingUserIds);

      await this.syncTransclusion(pageId, page.workspaceId, tiptapJson);

      await this.queueMentionNotifications(
        page,
        tiptapJson,
        page.content,
        false,
      );

      await this.aiQueue.add(QueueJob.PAGE_CONTENT_UPDATED, {
        pageIds: [pageId],
        workspaceId: page.workspaceId,
      });

      await this.enqueuePageHistory(page);
    }
  }

  // Drop malformed awareness before it is broadcast
  async beforeHandleAwareness({
    states,
    context,
  }: beforeHandleAwarenessPayload) {
    const user = context?.user;

    for (const [clientId, state] of states) {
      if (!isRenderableObject(state)) {
        states.delete(clientId);
        continue;
      }

      if ('user' in state && !isRenderableObject(state.user)) {
        delete state.user;
      }

      if (state.user && user) {
        state.user.id = user.id;
        state.user.avatarUrl = user.avatarUrl ?? null;
      }

      if (
        'cursor' in state &&
        state.cursor !== null &&
        !isRenderableObject(state.cursor)
      ) {
        delete state.cursor;
      }
    }
  }

  async onChange(data: onChangePayload) {
    const userId = data.context?.user?.id;
    if (!userId) return;
    this.trackContributor(data.documentName, userId);
  }

  private trackContributor(documentName: string, userId: string) {
    if (!this.contributors.has(documentName)) {
      this.contributors.set(documentName, new Set());
    }

    this.contributors.get(documentName).add(userId);
  }

  async afterUnloadDocument(data: afterUnloadDocumentPayload) {
    const documentName = data.documentName;
    this.contributors.delete(documentName);
  }

  private consumeContributors(documentName: string): string[] {
    const contributorSet = this.contributors.get(documentName);
    if (!contributorSet) return [];
    const userIds = [...contributorSet];
    this.contributors.delete(documentName);
    return userIds;
  }

  // Routing is read on every load, never cached, so control changes apply at once.
  private async findLoadSource(page: Page): Promise<YdocSource> {
    const [state, draft] = await Promise.all([
      this.pageApprovalService.getState(page),
      this.pageDraftRepo.findByPageId(page.id, {
        includeContent: true,
        includeYdoc: true,
      }),
    ]);

    if (draft && state.controlled) return draft;
    if (!draft && !state.controlled) return page;
    // healing or creating a draft is decided again under the page lock
    return this.resolveLoadSourceLocked(page);
  }

  private async resolveLoadSourceLocked(page: Page): Promise<YdocSource> {
    return executeTx(this.db, async (trx) => {
      const lockedPage = await this.pageRepo.findById(page.id, {
        withLock: true,
        includeContent: true,
        includeYdoc: true,
        trx,
      });
      const state = await this.pageApprovalService.getState(page, trx);
      const draft = await this.pageDraftRepo.findByPageId(page.id, {
        includeContent: true,
        includeYdoc: true,
        trx,
      });

      if (draft && !state.controlled) {
        await this.pageDraftRepo.copyBackToPage(page.id, trx);
        return draft;
      }
      if (draft) return draft;
      if (state.controlled) {
        return this.pageDraftRepo.createFromPage(page.id, trx);
      }
      return lockedPage ?? page;
    });
  }

  // Runs under the page row lock; a missing draft is created from the page with the same trx.
  private async storeDraft(
    input: {
      page: Page;
      state: ApprovalState;
      draft: PageDraft | undefined;
      tiptapJson: unknown;
      ydocState: Buffer;
      lastUserId: string | undefined;
      editingUserIds: string[];
    },
    trx: KyselyTransaction,
  ): Promise<DraftStore> {
    const { page, state, tiptapJson, lastUserId, editingUserIds } = input;
    const created = !input.draft;
    const draft =
      input.draft ?? (await this.pageDraftRepo.createFromPage(page.id, trx));

    const changed = !isDeepStrictEqual(tiptapJson, draft.content);
    // a new draft always takes the live ydoc so its Yjs history matches the clients
    if (changed || created) {
      const contributorIds = [
        ...new Set([
          ...(draft.contributorIds ?? []),
          ...editingUserIds,
          page.creatorId,
        ]),
      ].filter(Boolean);

      const updatedRows = await this.pageDraftRepo.updateContent(
        page.id,
        {
          content: tiptapJson,
          ydoc: input.ydocState,
          lastUpdatedById: lastUserId ?? draft.lastUpdatedById,
          contributorIds,
        },
        trx,
      );
      if (updatedRows === 0) {
        throw new Error(`Draft of page ${page.id} not found`);
      }
      this.logger.debug(`Draft updated: ${page.id}`);
    }

    return { page, state, changed, previousContent: draft.content };
  }

  private async afterContentStored(
    document: Document,
    lastContext: onStoreDocumentPayload['lastContext'],
    page: Page,
    editingUserIds: string[],
  ): Promise<void> {
    try {
      await this.collabHistory.addContributors(page.id, editingUserIds);
    } catch (err) {
      this.logger.error(
        { err, pageId: page.id },
        'Failed to add history contributors for page',
      );
    }

    document.broadcastStateless(
      JSON.stringify({
        type: 'page.updated',
        updatedAt: new Date().toISOString(),
        lastUpdatedById: lastContext?.user?.id,
        lastUpdatedBy: lastContext?.user
          ? {
              id: lastContext.user?.id,
              name: lastContext.user?.name,
              avatarUrl: lastContext.user?.avatarUrl,
            }
          : undefined,
      }),
    );
  }

  private async queueMentionNotifications(
    page: Page,
    tiptapJson: unknown,
    previousContent: unknown,
    draftOnly: boolean,
  ): Promise<void> {
    const mentions = extractMentions(tiptapJson);

    const userMentions = extractUserMentions(mentions);
    if (userMentions.length === 0) return;

    const oldMentions = previousContent ? extractMentions(previousContent) : [];
    const oldMentionedUserIds = extractUserMentions(oldMentions).map(
      (m) => m.entityId,
    );

    await this.notificationQueue.add(QueueJob.PAGE_MENTION_NOTIFICATION, {
      userMentions: userMentions.map((m) => ({
        userId: m.entityId,
        mentionId: m.id,
        creatorId: m.creatorId,
      })),
      oldMentionedUserIds,
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      ...(draftOnly ? { draftOnly: true } : {}),
    } as IPageMentionNotificationJob);
  }

  // Catches users whose collab recheck message was missed.
  private async closeConnectionsWithoutDraftAccess(
    document: Document,
    page: Page,
    state: ApprovalState,
  ): Promise<void> {
    const draftAccess = new Map<string, Promise<boolean>>();

    for (const connection of document.getConnections()) {
      const userId: string | undefined = connection.context?.user?.id;
      try {
        if (userId && !draftAccess.has(userId)) {
          draftAccess.set(
            userId,
            this.pageApprovalService.canAccessDraft({ id: userId }, page, state),
          );
        }
        if (userId && (await draftAccess.get(userId))) continue;

        connection.sendStateless(
          JSON.stringify({ type: 'page.permissions', access: 'none' }),
        );
        connection.readOnly = true;
        connection.close(Forbidden);
      } catch (err) {
        this.logger.error(
          { err, pageId: page.id },
          'Failed to recheck draft access for page',
        );
      }
    }
  }

  private async enqueuePageHistory(page: Page): Promise<void> {
    const pageAge = Date.now() - new Date(page.createdAt).getTime();
    const delay =
      pageAge < HISTORY_FAST_THRESHOLD
        ? HISTORY_FAST_INTERVAL
        : HISTORY_INTERVAL;

    await this.historyQueue.add(
      QueueJob.PAGE_HISTORY,
      { pageId: page.id } as IPageHistoryJob,
      { jobId: page.id, delay },
    );
  }

  /**
   * Refresh `page_transclusions` and `page_transclusion_references` to match
   * the page's current content. Runs outside the page-write transaction and
   * isolates each call so a failure here cannot affect the page save itself.
   * The diff is idempotent — the next save converges if a round drops anything.
   */
  private async syncTransclusion(
    pageId: string,
    workspaceId: string,
    tiptapJson: unknown,
  ): Promise<void> {
    try {
      await this.transclusionService.syncPageTransclusions(
        pageId,
        workspaceId,
        tiptapJson,
      );
    } catch (err) {
      this.logger.error(
        { err, pageId },
        'Failed to sync transclusions for page',
      );
    }
    try {
      await this.transclusionService.syncPageReferences(
        pageId,
        workspaceId,
        tiptapJson,
      );
    } catch (err) {
      this.logger.error(
        { err, pageId },
        'Failed to sync transclusion references for page',
      );
    }
  }
}
