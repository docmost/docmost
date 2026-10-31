import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CommentService } from './comment.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';
import { PageIdDto, CommentIdDto } from './dto/comments.input.js';
import { AuthUser } from '../../common/decorators/auth-user.decorator.js';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator.js';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options.js';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory.js';
import { PageRepo } from '@docmost/db/repos/page/page.repo.js';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type.js';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo.js';
import { PageAccessService } from '../page/page-access/page-access.service.js';
import { AuditEvent, AuditResource } from '../../common/events/audit-events.js';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service.js';
import { WsService } from '../../ws/ws.service.js';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentRepo: CommentRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
    private readonly wsService: WsService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @OAuthScope('write')
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(createCommentDto.pageId);
    if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanComment(page, user, workspace.id);

    const comment = await this.commentService.create(
      {
        page,
        workspaceId: workspace.id,
        user,
      },
      createCommentDto,
    );

    this.auditService.log({
      event: AuditEvent.COMMENT_CREATED,
      resourceType: AuditResource.COMMENT,
      resourceId: comment.id,
      spaceId: page.spaceId,
      metadata: {
        pageId: page.id,
      },
    });

    return comment;
  }

  @HttpCode(HttpStatus.OK)
  @Post('/')
  @OAuthScope('read')
  async findPageComments(
    @Body() input: PageIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(input.pageId);
    if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return this.commentService.findByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async findOne(
    @Body() input: CommentIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return comment;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @OAuthScope('write')
  async update(@Body() dto: UpdateCommentDto, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const comment = await this.commentRepo.findById(dto.commentId, {
      includeCreator: true,
      includeResolvedBy: true,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanComment(page, user, workspace.id);

    const updatedComment = await this.commentService.update(comment, dto, user);

    this.auditService.log({
      event: AuditEvent.COMMENT_UPDATED,
      resourceType: AuditResource.COMMENT,
      resourceId: comment.id,
      spaceId: comment.spaceId,
      metadata: {
        pageId: comment.pageId,
      },
    });

    return updatedComment;
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() input: CommentIdDto, @AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page || page.workspaceId !== workspace.id || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanComment(page, user, workspace.id);

    // Check if user is the comment owner
    const isOwner = comment.creatorId === user.id;

    if (isOwner) {
      await this.commentRepo.deleteComment(comment.id);
    } else {
      const ability = await this.spaceAbility.createForUser(
        user,
        comment.spaceId,
      );

      // Space admin can delete any comment
      if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
        throw new ForbiddenException(
          'You can only delete your own comments',
        );
      }
      await this.commentRepo.deleteComment(comment.id);
    }

    this.wsService.emitCommentEvent(comment.spaceId, comment.pageId, {
      operation: 'commentDeleted',
      pageId: comment.pageId,
      commentId: comment.id,
    });

    this.auditService.log({
      event: AuditEvent.COMMENT_DELETED,
      resourceType: AuditResource.COMMENT,
      resourceId: comment.id,
      spaceId: comment.spaceId,
      changes: {
        before: {
          pageId: comment.pageId,
          creatorId: comment.creatorId,
        },
      },
    });
  }
}
