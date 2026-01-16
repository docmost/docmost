import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../queue/constants';
import {
  extractMentions,
  extractUserMentions,
  MentionNode,
} from '../../common/helpers/prosemirror/mentions';
import { MentionEmailNotificationRepo } from '../../database/repos/mention/mention-email-notification.repo';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class MentionNotificationService {
  private readonly logger = new Logger(MentionNotificationService.name);
  constructor(
    @InjectQueue(QueueName.GENERAL_QUEUE) private readonly generalQueue: Queue,
    private readonly mentionEmailNotificationRepo: MentionEmailNotificationRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  async scheduleMentionEmails(opts: {
    workspaceId: string;
    actorUserId: string;
    source: 'page' | 'comment';
    prosemirrorJson: any;
    pageId?: string;
    commentId?: string;
    cooldownMs?: number;
  }): Promise<void> {
    const cooldownMs =
      opts.cooldownMs ?? this.environmentService.getMentionEmailCooldownMs();

    const mentions = extractMentions(opts.prosemirrorJson);
    const userMentions = extractUserMentions(mentions);

    this.logger.debug(
      `scheduleMentionEmails source=${opts.source} workspaceId=${opts.workspaceId} actorUserId=${opts.actorUserId} pageId=${opts.pageId ?? '-'} commentId=${opts.commentId ?? '-'} cooldownMs=${cooldownMs} mentions(total=${mentions.length}, user=${userMentions.length})`,
    );

    // Deduplicate by mention.id (stable node id)
    const unique = new Map<string, MentionNode>();
    for (const m of userMentions) unique.set(m.id, m);

    // Filter out self-mentions + malformed
    const candidates = Array.from(unique.values()).filter(
      (m) =>
        !!m.id &&
        !!m.entityId &&
        m.entityType === 'user' &&
        m.entityId !== opts.actorUserId,
    );

    if (!candidates.length) {
      this.logger.debug(`scheduleMentionEmails no candidates (after dedupe/self-filter)`);
      return;
    }

    // Avoid enqueueing if we've already sent this mention email (batch check)
    const mentionIds = candidates.map((m) => m.id);
    const alreadySent = await this.mentionEmailNotificationRepo.findSentMentionIds(
      opts.workspaceId,
      mentionIds,
    );

    const enqueue = candidates.filter((m) => !alreadySent.has(m.id));
    if (!enqueue.length) {
      this.logger.debug(
        `scheduleMentionEmails all candidates already sent (count=${candidates.length})`,
      );
      return;
    }

    await Promise.all(
      enqueue.map(async (m) => {
        const jobId = `mention-email:${opts.workspaceId}:${m.id}`;
        this.logger.debug(
          `scheduleMentionEmails enqueue jobId=${jobId} mentionedUserId=${m.entityId} delayMs=${cooldownMs} source=${opts.source} pageId=${opts.pageId ?? '-'} commentId=${opts.commentId ?? '-'}`,
        );
        await this.generalQueue.add(
          QueueJob.MENTION_EMAIL,
          {
            workspaceId: opts.workspaceId,
            source: opts.source,
            mentionId: m.id,
            mentionedUserId: m.entityId,
            actorUserId: opts.actorUserId,
            pageId: opts.pageId,
            commentId: opts.commentId,
          },
          {
            jobId,
            delay: cooldownMs,
          },
        );
      }),
    );
  }
}


