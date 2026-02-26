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
import { PageAccessService } from '../page/page-access/page-access.service';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly commentRepo: CommentRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageAccessService: PageAccessService,
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

    await this.pageAccessService.validateCanEdit(page, user);

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

    await this.pageAccessService.validateCanView(page, user);

    return this.commentService.findByPageId(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async findOne(@Body() input: CommentIdDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    return comment;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() dto: UpdateCommentDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(dto.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanEdit(page, user);

    return this.commentService.update(comment, dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() input: CommentIdDto, @AuthUser() user: User) {
    const comment = await this.commentRepo.findById(input.commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const page = await this.pageRepo.findById(comment.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Check page-level edit permission first
    await this.pageAccessService.validateCanEdit(page, user);

    // Check if user is the comment owner
    const isOwner = comment.creatorId === user.id;

    if (isOwner) {
      await this.commentRepo.deleteComment(comment.id);
      return;
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      comment.spaceId,
    );

    // Space admin can delete any comment
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException(
        'You can only delete your own comments or must be a space admin',
      );
    }
    await this.commentRepo.deleteComment(comment.id);
  }
}
