import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateCommentDto, yjsSelectionSchema } from './dto/create-comment.dto';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { extractUserMentionIdsFromJson } from '../../common/helpers/prosemirror/utils';
import { ICommentNotificationJob } from '../../integrations/queue/constants/queue.interface';
import { WsService } from '../../ws/ws.service';
import { PageAccessService } from '../page/page-access/page-access.service';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import {
  assertReaderCommentAllowed,
  CommentAccess,
  CommentSource,
  CommentViewerAccess,
  isCommentVisible,
  isInternalComment,
  shouldStampInternal,
  toViewerComment,
} from './comment.utils';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private commentRepo: CommentRepo,
    private wsService: WsService,
    private collaborationGateway: CollaborationGateway,
    private pageAccessService: PageAccessService,
    private spaceAbility: SpaceAbilityFactory,
    @InjectQueue(QueueName.GENERAL_QUEUE)
    private generalQueue: Queue,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private notificationQueue: Queue,
  ) {}

  async findById(commentId: string) {
    const comment = await this.commentRepo.findById(commentId, {
      includeCreator: true,
      includeResolvedBy: true,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  // Callers have already checked that the user can view the page.
  async getViewerAccess(page: Page, user: User): Promise<CommentViewerAccess> {
    const { canEdit, state, canAccessDraft } =
      await this.pageAccessService.getDraftAccess(page, user);
    return { controlled: state.controlled, canAccessDraft, canEdit };
  }

  async assertCommentVisible(
    comment: Comment,
    page: Page,
    user: User,
  ): Promise<CommentAccess> {
    const access = await this.getViewerAccess(page, user);

    const root = comment.parentCommentId
      ? ((await this.commentRepo.findById(comment.parentCommentId)) ?? null)
      : null;
    if (!isCommentVisible(comment, root, access)) {
      throw new NotFoundException('Comment not found');
    }

    return {
      ...access,
      internal: isInternalComment(comment, root, access.controlled),
    };
  }

  async findVisibleComment(
    comment: Comment,
    page: Page,
    user: User,
  ): Promise<Comment> {
    const access = await this.assertCommentVisible(comment, page, user);
    return toViewerComment(comment, access);
  }

  async create(
    opts: { page: Page; workspaceId: string; user: User; source?: CommentSource },
    createCommentDto: CreateCommentDto,
  ) {
    const { page, workspaceId, user, source } = opts;
    const commentContent = JSON.parse(createCommentDto.content);
    const access = await this.getViewerAccess(page, user);

    let parentComment: Comment | undefined;
    if (createCommentDto.parentCommentId) {
      parentComment = await this.commentRepo.findById(
        createCommentDto.parentCommentId,
      );

      if (!parentComment || parentComment.pageId !== page.id) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parentComment.parentCommentId !== null) {
        // Users without draft access learn nothing about replies they cannot see.
        if (!access.canAccessDraft) {
          const parentRoot = await this.commentRepo.findById(
            parentComment.parentCommentId,
          );
          if (!isCommentVisible(parentComment, parentRoot ?? null, access)) {
            throw new BadRequestException('Parent comment not found');
          }
        }
        throw new BadRequestException('You cannot reply to a reply');
      }
    }

    assertReaderCommentAllowed(createCommentDto, parentComment ?? null, access);

    const type = createCommentDto.type ?? 'page';
    const selection = createCommentDto?.selection?.substring(0, 250) || null;

    const inserted = await this.commentRepo.insertComment({
      pageId: page.id,
      content: commentContent,
      selection,
      type,
      parentCommentId: createCommentDto?.parentCommentId,
      creatorId: user.id,
      workspaceId: workspaceId,
      spaceId: page.spaceId,
      isInternal: shouldStampInternal({
        controlled: access.controlled,
        canAccessDraft: access.canAccessDraft,
        source,
        parentCommentId: createCommentDto.parentCommentId,
        type,
        selection,
        yjsSelection: createCommentDto.yjsSelection,
      }),
    });

    if (createCommentDto.yjsSelection) {
      const parsed = yjsSelectionSchema.safeParse(createCommentDto.yjsSelection);
      if (!parsed.success) {
        this.logger.warn(
          `Invalid yjsSelection for comment ${inserted.id}: ${parsed.error.message}`,
        );
      } else {
        const documentName = `page.${page.id}`;
        try {
          await this.collaborationGateway.handleYjsEvent(
            'setCommentMark',
            documentName,
            {
              yjsSelection: parsed.data,
              commentId: inserted.id,
              resolved: false,
              user,
            },
          );
        } catch (error) {
          this.logger.warn(
            `Failed to apply comment mark for comment ${inserted.id}, comment saved without inline highlight`,
            error,
          );
        }
      }
    }

    const comment = await this.commentRepo.findById(inserted.id, {
      includeCreator: true,
      includeResolvedBy: true,
    });
    const commentAccess: CommentAccess = {
      ...access,
      internal: isInternalComment(
        comment,
        parentComment ?? null,
        access.controlled,
      ),
    };

    this.generalQueue
      .add(QueueJob.ADD_PAGE_WATCHERS, {
        userIds: [user.id],
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId,
      })
      .catch((err) =>
        this.logger.warn(`Failed to queue add-page-watchers: ${err.message}`),
      );

    const isReply = !!createCommentDto.parentCommentId;

    await this.queueCommentNotification(
      commentContent,
      [],
      comment.id,
      page.id,
      page.spaceId,
      workspaceId,
      user.id,
      !isReply,
      createCommentDto.parentCommentId,
      commentAccess.internal,
    );

    this.wsService.emitCommentEvent(
      page.spaceId,
      page.id,
      {
        operation: 'commentCreated',
        pageId: page.id,
        comment: this.toEventComment(comment, commentAccess),
      },
      { draftOnly: commentAccess.internal },
    );

    return toViewerComment(comment, access);
  }

  async findByPageId(
    page: Page,
    pagination: PaginationOptions,
    user: User,
  ): Promise<CursorPaginationResult<Comment>> {
    const access = await this.getViewerAccess(page, user);

    const result = await this.commentRepo.findPageComments(page.id, pagination, {
      publicThreadsOnly: !access.canAccessDraft,
      controlled: access.controlled,
    });
    if (!access.controlled || access.canAccessDraft) return result;

    return {
      ...result,
      items: result.items.map((comment) => toViewerComment(comment, access)),
    };
  }

  async update(
    comment: Comment,
    updateCommentDto: UpdateCommentDto,
    authUser: User,
    page: Page,
  ): Promise<Comment> {
    const access = await this.assertCommentVisible(comment, page, authUser);
    const commentContent = JSON.parse(updateCommentDto.content);

    if (comment.creatorId !== authUser.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const oldMentionIds = extractUserMentionIdsFromJson(comment.content);

    const editedAt = new Date();

    await this.commentRepo.updateComment(
      {
        content: commentContent,
        editedAt: editedAt,
        updatedAt: editedAt,
      },
      comment.id,
    );

    await this.queueCommentNotification(
      commentContent,
      oldMentionIds,
      comment.id,
      comment.pageId,
      comment.spaceId,
      comment.workspaceId,
      authUser.id,
      false,
      undefined,
      access.internal,
    );

    comment.content = commentContent;
    comment.editedAt = editedAt;
    comment.updatedAt = editedAt;

    this.wsService.emitCommentEvent(
      comment.spaceId,
      comment.pageId,
      {
        operation: 'commentUpdated',
        pageId: comment.pageId,
        comment: this.toEventComment(comment, access),
      },
      { draftOnly: access.internal },
    );

    return toViewerComment(comment, access);
  }

  async delete(comment: Comment, page: Page, user: User): Promise<void> {
    const access = await this.assertCommentVisible(comment, page, user);

    if (comment.creatorId !== user.id) {
      const ability = await this.spaceAbility.createForUser(
        user,
        comment.spaceId,
      );

      // Space admin can delete any comment
      if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
        throw new ForbiddenException('You can only delete your own comments');
      }
    }

    await this.commentRepo.deleteComment(comment.id);

    this.wsService.emitCommentEvent(
      comment.spaceId,
      comment.pageId,
      {
        operation: 'commentDeleted',
        pageId: comment.pageId,
        commentId: comment.id,
      },
      { draftOnly: access.internal },
    );
  }

  // Public comment events reach readers of controlled pages too.
  private toEventComment(comment: Comment, access: CommentAccess): Comment {
    if (!access.controlled || access.internal) return comment;
    return { ...comment, selection: null };
  }

  private async queueCommentNotification(
    content: any,
    oldMentionIds: string[],
    commentId: string,
    pageId: string,
    spaceId: string,
    workspaceId: string,
    actorId: string,
    notifyWatchers: boolean,
    parentCommentId?: string,
    draftOnly = false,
  ) {
    const mentionedUserIds = extractUserMentionIdsFromJson(content);
    const newMentionIds = mentionedUserIds.filter(
      (id) => id !== actorId && !oldMentionIds.includes(id),
    );

    if (newMentionIds.length === 0 && !notifyWatchers && !parentCommentId) return;

    const jobData: ICommentNotificationJob = {
      commentId,
      parentCommentId,
      pageId,
      spaceId,
      workspaceId,
      actorId,
      mentionedUserIds: newMentionIds,
      notifyWatchers,
      ...(draftOnly ? { draftOnly: true } : {}),
    };

    await this.notificationQueue.add(
      QueueJob.COMMENT_NOTIFICATION,
      jobData,
    );
  }
}
