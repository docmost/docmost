import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { WsService } from '../../ws/ws.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentEeController {
  constructor(
    private readonly commentRepo: CommentRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly wsService: WsService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  async resolve(
    @Body() dto: { commentId: string; resolved: boolean },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const comment = await this.commentRepo.findById(dto.commentId, {
      includeCreator: true,
      includeResolvedBy: true,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanComment(page, user, workspace.id);

    const resolvedAt = dto.resolved ? new Date() : null;
    const resolvedById = dto.resolved ? user.id : null;

    await this.commentRepo.updateComment(
      {
        resolvedAt,
        resolvedById,
        updatedAt: new Date(),
      },
      comment.id,
    );

    const updated = await this.commentRepo.findById(comment.id, {
      includeCreator: true,
      includeResolvedBy: true,
    });

    this.wsService.emitCommentEvent(comment.spaceId, comment.pageId, {
      operation: 'commentUpdated',
      pageId: comment.pageId,
      comment: updated,
    });

    if (dto.resolved && comment.creatorId && comment.creatorId !== user.id) {
      await this.notificationQueue.add(QueueJob.COMMENT_RESOLVED_NOTIFICATION, {
        commentId: comment.id,
        commentCreatorId: comment.creatorId,
        pageId: comment.pageId,
        spaceId: comment.spaceId,
        workspaceId: comment.workspaceId,
        actorId: user.id,
      });
    }

    this.auditService.log({
      event: dto.resolved ? AuditEvent.COMMENT_RESOLVED : AuditEvent.COMMENT_REOPENED,
      resourceType: AuditResource.COMMENT,
      resourceId: comment.id,
      spaceId: comment.spaceId,
      changes: {
        before: { resolvedAt: comment.resolvedAt, resolvedById: comment.resolvedById },
        after: { resolvedAt, resolvedById },
      },
    });

    return updated;
  }
}

