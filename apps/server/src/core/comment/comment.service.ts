import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment, Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class CommentService {
  constructor(
    private commentRepo: CommentRepo,
    private pageRepo: PageRepo,
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
}
