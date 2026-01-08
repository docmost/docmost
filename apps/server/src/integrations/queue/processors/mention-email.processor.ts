import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../constants';
import { IMentionEmailJob } from '../constants/queue.interface';
import { MailService } from '../../mail/mail.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { DomainService } from '../../environment/domain.service';
import {
  extractMentions,
  prosemirrorToTextWithMentions,
  snippetForMentionId,
} from '../../../common/helpers/prosemirror/mentions';
import MentionEmail from '../../transactional/emails/mention-email';
import slugify = require('@sindresorhus/slugify');
import { MentionEmailNotificationRepo } from '../../../database/repos/mention/mention-email-notification.repo';

function normalizeSnippet(text: string, maxLen: number): string {
  const safe = (text || '').replace(/\s+/g, ' ').trim();
  if (!safe) return '';
  if (safe.length <= maxLen) return safe;
  return `${safe.slice(0, maxLen - 1)}…`;
}

@Processor(QueueName.GENERAL_QUEUE)
export class MentionEmailProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(MentionEmailProcessor.name);
  constructor(
    private readonly mailService: MailService,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly userRepo: UserRepo,
    private readonly pageRepo: PageRepo,
    private readonly commentRepo: CommentRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly domainService: DomainService,
    private readonly mentionEmailNotificationRepo: MentionEmailNotificationRepo,
  ) {
    super();
  }

  async process(job: Job<IMentionEmailJob, void>): Promise<void> {
    if (job.name !== QueueJob.MENTION_EMAIL) return;

    const {
      workspaceId,
      source,
      mentionId,
      mentionedUserId,
      actorUserId,
      pageId,
      commentId,
    } = job.data;

    this.logger.debug(
      `start mention-email jobId=${job.id ?? '-'} workspaceId=${workspaceId} source=${source} mentionId=${mentionId} mentionedUserId=${mentionedUserId} actorUserId=${actorUserId} pageId=${pageId ?? '-'} commentId=${commentId ?? '-'}`,
    );

    // Dedupe: if already recorded as sent, exit quickly.
    const sent = await this.mentionEmailNotificationRepo.findSentMentionIds(
      workspaceId,
      [mentionId],
    );
    if (sent.has(mentionId)) {
      this.logger.debug(`skip mention-email (already sent) mentionId=${mentionId}`);
      return;
    }

    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      this.logger.debug(`skip mention-email (workspace not found) workspaceId=${workspaceId}`);
      return;
    }

    const mentionedUser = await this.userRepo.findById(
      mentionedUserId,
      workspaceId,
    );
    if (!mentionedUser || mentionedUser.deletedAt || mentionedUser.deactivatedAt)
    {
      this.logger.debug(
        `skip mention-email (mentioned user missing/deleted/deactivated) mentionedUserId=${mentionedUserId}`,
      );
      return;
    }

    const actorUser = await this.userRepo.findById(actorUserId, workspaceId);
    const mentionedByName = actorUser?.name || 'Someone';

    let resolvedPageId = pageId;
    let commentSelection: string | null = null;
    let commentText: string | null = null;
    let prosemirrorJson: any = null;

    if (source === 'comment') {
      if (!commentId) return;
      const comment = await this.commentRepo.findById(commentId, {
        includeCreator: false,
        includeResolvedBy: false,
      });
      if (!comment || comment.deletedAt) {
        this.logger.debug(
          `skip mention-email (comment missing/deleted) commentId=${commentId}`,
        );
        return;
      }

      resolvedPageId = comment.pageId;
      commentSelection = comment.selection ?? null;
      prosemirrorJson = comment.content;
      commentText = prosemirrorToTextWithMentions(comment.content).slice(0, 500);
    } else {
      if (!resolvedPageId) return;
      const page = await this.pageRepo.findById(resolvedPageId, {
        includeContent: true,
      });
      if (!page || page.deletedAt) {
        this.logger.debug(
          `skip mention-email (page missing/deleted) pageId=${resolvedPageId}`,
        );
        return;
      }
      prosemirrorJson = page.content;
    }

    // Cooling-off re-check: confirm the mention node still exists & matches the same user.
    const mentions = extractMentions(prosemirrorJson);
    const stillThere = mentions.some(
      (m) => m.id === mentionId && m.entityType === 'user' && m.entityId === mentionedUserId,
    );
    if (!stillThere) {
      this.logger.debug(
        `skip mention-email (mention no longer present after cooldown) mentionId=${mentionId}`,
      );
      return;
    }

    const page = await this.pageRepo.findById(resolvedPageId, {
      includeContent: true,
    });
    if (!page || page.deletedAt) {
      this.logger.debug(
        `skip mention-email (page missing/deleted at send time) pageId=${resolvedPageId}`,
      );
      return;
    }

    const space = await this.spaceRepo.findById(page.spaceId, workspaceId);
    if (!space) {
      this.logger.debug(
        `skip mention-email (space not found) spaceId=${page.spaceId}`,
      );
      return;
    }

    const baseUrl = this.domainService.getUrl(workspace.hostname);
    const linkTitle = page.title || 'Untitled';
    const truncatedTitle = linkTitle.substring(0, 70);
    const pageSlug = `${slugify(truncatedTitle)}-${page.slugId}`;
    const link = `${baseUrl}/s/${space.slug}/p/${pageSlug}`;

    const text = prosemirrorToTextWithMentions(
      source === 'comment' ? prosemirrorJson : page.content,
    );
    const excerpt =
      source === 'comment'
        ? normalizeSnippet(commentSelection ?? '', 300)
        : snippetForMentionId(page.content, mentionId, { minLen: 120, maxLen: 300 }) ||
          normalizeSnippet(text, 300);
    this.logger.debug(
      `prepared mention-email excerptLen=${excerpt?.length ?? 0} commentSelectionLen=${commentSelection?.length ?? 0} commentTextLen=${commentText?.length ?? 0}`,
    );

    const emailTemplate = MentionEmail({
      mentionedByName,
      pageTitle: linkTitle,
      link,
      excerpt,
      commentSelection,
      commentText,
    });

    await this.mailService.sendToQueue({
      to: mentionedUser.email,
      subject: `${mentionedByName} mentioned you in ${linkTitle}`,
      template: emailTemplate,
    });
    this.logger.debug(`queued send-email to=${mentionedUser.email} mentionId=${mentionId}`);

    await this.mentionEmailNotificationRepo.insertSent({
      workspaceId,
      mentionId,
      source,
      mentionedUserId,
      actorUserId,
      pageId: resolvedPageId,
      commentId: commentId ?? null,
    });
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    if (job.name === QueueJob.MENTION_EMAIL) {
      this.logger.debug(`Processing ${job.name} job`);
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    if (job.name === QueueJob.MENTION_EMAIL) {
      this.logger.error(
        `Error processing ${job.name} job. Reason: ${job.failedReason}`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (job.name === QueueJob.MENTION_EMAIL) {
      this.logger.debug(`Completed ${job.name} job`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}


