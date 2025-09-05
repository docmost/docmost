import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PageIdDto, CommentIdDto } from './dto/comments.input';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { CommentRepo } from '@docmost/db/repos/comment/comment.repo';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentRepo: CommentRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(createCommentDto.pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.commentService.create(
      {
        userId: user.id,
        page,
        workspaceId: workspace.id,
      },
      createCommentDto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async findPageComments(
    @Body() input: PageIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(input.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return this.commentService.findByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async findOne(@Body() input: CommentIdDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      comment.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return comment;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateCommentDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(dto.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      comment.spaceId,
    );

    // must be a space member with edit permission
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException(
        'You must have space edit permission to edit comments',
      );
    }

    return this.commentService.update(comment, dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() input: CommentIdDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      comment.spaceId,
    );

    // must be a space member with edit permission
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    // Check if user is the comment owner
    const isOwner = comment.creatorId === user.id;

    if (isOwner) {
      /*
      // Check if comment has children from other users
      const hasChildrenFromOthers =
        await this.commentRepo.hasChildrenFromOtherUsers(comment.id, user.id);

      // Owner can delete if no children from other users
      if (!hasChildrenFromOthers) {
        await this.commentRepo.deleteComment(comment.id);
        return;
      }

      // If has children from others, only space admin can delete
      if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
        throw new ForbiddenException(
          'Only space admins can delete comments with replies from other users',
        );
      }*/
      await this.commentRepo.deleteComment(comment.id);
      return;
    }

    // Space admin can delete any comment
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException(
        'You can only delete your own comments or must be a space admin',
      );
    }
    await this.commentRepo.deleteComment(comment.id);
  }
}
