import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { User } from '@docmost/db/types/entity.types';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { WsService } from '../../ws/ws.service';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';

@Injectable()
export class CommentResolveService {
  constructor(
    private readonly commentRepo: CommentRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly collaborationGateway: CollaborationGateway,
    private readonly wsService: WsService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async resolve(
    data: { commentId: string; pageId: string; resolved: boolean },
    user: User,
    workspaceId: string,
  ) {
    const comment = await this.commentRepo.findById(data.commentId, {
      includeCreator: true,
      includeResolvedBy: true,
    });
    if (!comment || comment.pageId !== data.pageId) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(data.pageId);
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanComment(page, user, workspaceId);

    if (comment.parentCommentId) {
      throw new BadRequestException('Only parent comments can be resolved');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    const canManage =
      comment.creatorId === user.id ||
      ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings);

    if (!canManage) {
      throw new ForbiddenException();
    }

    const resolvedAt = data.resolved ? new Date() : null;
    const resolvedById = data.resolved ? user.id : null;

    await this.commentRepo.updateComment(
      {
        resolvedAt,
        resolvedById,
        updatedAt: new Date(),
      },
      comment.id,
    );

    try {
      await this.collaborationGateway.handleYjsEvent(
        'resolveCommentMark',
        `page.${page.id}`,
        {
          commentId: comment.id,
          resolved: data.resolved,
          user,
        },
      );
    } catch {
      // Comment saved even if inline mark update fails.
    }

    const updated = await this.commentRepo.findById(comment.id, {
      includeCreator: true,
      includeResolvedBy: true,
    });

    this.wsService.emitCommentEvent(page.spaceId, page.id, {
      operation: 'commentUpdated',
      pageId: page.id,
      comment: updated,
    });

    if (data.resolved) {
      await this.notificationQueue.add(QueueJob.COMMENT_RESOLVED_NOTIFICATION, {
        commentId: comment.id,
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId,
        actorId: user.id,
      });
    }

    this.auditService.log({
      event: AuditEvent.COMMENT_RESOLVED,
      resourceType: AuditResource.COMMENT,
      resourceId: comment.id,
      spaceId: page.spaceId,
      metadata: { pageId: page.id, resolved: data.resolved },
    });

    return updated;
  }
}
