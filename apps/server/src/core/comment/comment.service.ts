import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PageService } from '../page/services/page.service';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';
import { Comment } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PaginationResult } from '@docmost/db/pagination/pagination';

@Injectable()
export class CommentService {
  constructor(
    private commentRepo: CommentRepo,
    private pageService: PageService,
  ) {}

  async findWithCreator(commentId: string) {
    // todo: find comment with creator object
  }

  async create(
    userId: string,
    workspaceId: string,
    createCommentDto: CreateCommentDto,
  ) {
    const commentContent = JSON.parse(createCommentDto.content);

    const page = await this.pageService.findById(createCommentDto.pageId);
    // const spaceId = null; // todo, get from page

    if (!page) {
      throw new BadRequestException('Page not found');
    }

    if (createCommentDto.parentCommentId) {
      const parentComment = await this.commentRepo.findById(
        createCommentDto.parentCommentId,
      );

      if (!parentComment) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException('You cannot reply to a reply');
      }
    }

    const createdComment = await this.commentRepo.insertComment({
      pageId: createCommentDto.pageId,
      content: commentContent,
      selection: createCommentDto?.selection.substring(0, 250),
      type: 'inline', // for now
      parentCommentId: createCommentDto?.parentCommentId,
      creatorId: userId,
      workspaceId: workspaceId,
    });
    // todo return created comment and creator relation

    return createdComment;
  }

  async findByPageId(
    pageId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Comment>> {
    const pageComments = await this.commentRepo.findPageComments(
      pageId,
      pagination,
    );

    return pageComments;
  }

  async update(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const commentContent = JSON.parse(updateCommentDto.content);

    await this.commentRepo.updateComment(
      {
        content: commentContent,
        editedAt: new Date(),
      },
      commentId,
    );

    return this.commentRepo.findById(commentId);
  }

  async remove(id: string): Promise<void> {
    await this.commentRepo.deleteComment(id);
  }
}
