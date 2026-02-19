import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { extractUserMentionIdsFromJson } from '../../common/helpers/prosemirror/utils';
import { ICommentNotificationJob } from '../../integrations/queue/constants/queue.interface';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private commentRepo: CommentRepo,
    private pageRepo: PageRepo,
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

  async create(
    opts: { userId: string; page: Page; workspaceId: string },
    createCommentDto: CreateCommentDto,
  ) {
    const { userId, page, workspaceId } = opts;
    const commentContent = JSON.parse(createCommentDto.content);

    if (createCommentDto.parentCommentId) {
      const parentComment = await this.commentRepo.findById(
        createCommentDto.parentCommentId,
      );

      if (!parentComment || parentComment.pageId !== page.id) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException('You cannot reply to a reply');
      }
    }

    const comment = await this.commentRepo.insertComment({
      pageId: page.id,
      content: commentContent,
      selection: createCommentDto?.selection?.substring(0, 250),
      type: 'inline',
      parentCommentId: createCommentDto?.parentCommentId,
      creatorId: userId,
      workspaceId: workspaceId,
      spaceId: page.spaceId,
    });

    this.generalQueue
      .add(QueueJob.ADD_PAGE_WATCHERS, {
        userIds: [userId],
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
      userId,
      !isReply,
      createCommentDto.parentCommentId,
    );

    return comment;
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Comment>> {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      throw new BadRequestException('Page not found');
    }

    return this.commentRepo.findPageComments(pageId, pagination);
  }

  async update(
    comment: Comment,
    updateCommentDto: UpdateCommentDto,
    authUser: User,
  ): Promise<Comment> {
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
    );

    comment.content = commentContent;
    comment.editedAt = editedAt;
    comment.updatedAt = editedAt;

    return comment;
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
    };

    await this.notificationQueue.add(
      QueueJob.COMMENT_NOTIFICATION,
      jobData,
    );
  }
}
