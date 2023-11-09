import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { plainToInstance } from 'class-transformer';
import { Comment } from './entities/comment.entity';
import { CommentRepository } from './repositories/comment.repository';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { PageService } from '../page/services/page.service';

@Injectable()
export class CommentService {
  constructor(
    private commentRepository: CommentRepository,
    private pageService: PageService,
  ) {}

  async findWithCreator(commentId: string) {
    return await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['creator'],
    });
  }

  async create(
    userId: string,
    workspaceId: string,
    createCommentDto: CreateCommentDto,
  ) {
    const comment = plainToInstance(Comment, createCommentDto);
    comment.creatorId = userId;
    comment.workspaceId = workspaceId;
    comment.content = JSON.parse(createCommentDto.content);

    if (createCommentDto.selection) {
      comment.selection = createCommentDto.selection.substring(0, 250);
    }

    const page = await this.pageService.findWithBasic(createCommentDto.pageId);
    if (!page) {
      throw new BadRequestException('Page not found');
    }

    if (createCommentDto.parentCommentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: createCommentDto.parentCommentId },
        select: ['id', 'parentCommentId'],
      });

      if (!parentComment) {
        throw new BadRequestException('Parent comment not found');
      }

      if (parentComment.parentCommentId !== null) {
        throw new BadRequestException('You cannot reply to a reply');
      }
    }

    const savedComment = await this.commentRepository.save(comment);
    return this.findWithCreator(savedComment.id);
  }

  async findByPageId(pageId: string, offset = 0, limit = 100) {
    const comments = this.commentRepository.find({
      where: {
        pageId: pageId,
      },
      order: {
        createdAt: 'asc',
      },
      take: limit,
      skip: offset,
      relations: ['creator'],
    });
    return comments;
  }

  async update(
    commentId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    updateCommentDto.content = JSON.parse(updateCommentDto.content);

    const result = await this.commentRepository.update(commentId, {
      ...updateCommentDto,
      editedAt: new Date(),
    });
    if (result.affected === 0) {
      throw new BadRequestException(`Comment not found`);
    }

    return this.findWithCreator(commentId);
  }

  async resolveComment(
    userId: string,
    resolveCommentDto: ResolveCommentDto,
  ): Promise<Comment> {
    const resolvedAt = resolveCommentDto.resolved ? new Date() : null;
    const resolvedById = resolveCommentDto.resolved ? userId : null;

    const result = await this.commentRepository.update(
      resolveCommentDto.commentId,
      {
        resolvedAt,
        resolvedById,
      },
    );

    if (result.affected === 0) {
      throw new BadRequestException(`Comment not found`);
    }

    return this.findWithCreator(resolveCommentDto.commentId);
  }

  async remove(id: string): Promise<void> {
    const result = await this.commentRepository.delete(id);
    if (result.affected === 0) {
      throw new BadRequestException(`Comment with ID ${id} not found.`);
    }
  }
}
