import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReadOnlyCommentDto } from './dto/create-readonly-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PaginationResult } from '@docmost/db/pagination/pagination';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { CollaborationGateway } from '../../collaboration/collaboration.gateway';
import { setYjsMark } from '../../collaboration/collaboration.util';
import * as Y from 'yjs';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private commentRepo: CommentRepo,
    private pageRepo: PageRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private collaborationGateway: CollaborationGateway,
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

    return await this.commentRepo.insertComment({
      pageId: page.id,
      content: commentContent,
      selection: createCommentDto?.selection?.substring(0, 250),
      type: 'inline',
      parentCommentId: createCommentDto?.parentCommentId,
      creatorId: userId,
      workspaceId: workspaceId,
      spaceId: page.spaceId,
    });
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Comment>> {
    const page = await this.pageRepo.findById(pageId);

    if (!page) {
      throw new BadRequestException('Page not found');
    }

    return await this.commentRepo.findPageComments(pageId, pagination);
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

    const editedAt = new Date();

    await this.commentRepo.updateComment(
      {
        content: commentContent,
        editedAt: editedAt,
        updatedAt: editedAt,
      },
      comment.id,
    );
    comment.content = commentContent;
    comment.editedAt = editedAt;
    comment.updatedAt = editedAt;

    return comment;
  }

  async createReadOnlyComment(
    opts: { userId: string; page: Page; workspaceId: string },
    createCommentDto: CreateReadOnlyCommentDto,
  ): Promise<Comment> {
    const { userId, page, workspaceId } = opts;
    const commentContent = JSON.parse(createCommentDto.content);

    const comment = await this.commentRepo.insertComment({
      pageId: page.id,
      content: commentContent,
      selection: createCommentDto?.selection?.substring(0, 250),
      type: 'inline',
      creatorId: userId,
      workspaceId: workspaceId,
      spaceId: page.spaceId,
    });

    const documentName = `page.${page.id}`;
    const directConnection =
      await this.collaborationGateway.openDirectConnection(documentName);

    try {
      await directConnection.transact((doc) => {
        const fragment = doc.getXmlFragment('default');
        setYjsMark(doc, fragment, createCommentDto.yjsSelection, 'comment', {
          commentId: comment.id,
          resolved: false,
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to apply comment mark for comment ${comment.id}`,
        error,
      );
      await this.commentRepo.deleteComment(comment.id);
      throw new BadRequestException(
        'Failed to apply comment mark. Selection may have changed.',
      );
    } finally {
      await directConnection.disconnect();
    }

    return comment;
  }
}
