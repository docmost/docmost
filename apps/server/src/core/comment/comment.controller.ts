import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PageIdDto, CommentIdDto } from './dto/comments.input';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.commentService.create(user.id, workspace.id, createCommentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  findPageComments(
    @Body() input: PageIdDto,
    @Body()
    pagination: PaginationOptions,
    //@AuthUser() user: User,
    //  @AuthWorkspace() workspace: Workspace,
  ) {
    return this.commentService.findByPageId(input.pageId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  findOne(@Body() input: CommentIdDto) {
    return this.commentService.findById(input.commentId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@Body() updateCommentDto: UpdateCommentDto) {
    return this.commentService.update(
      updateCommentDto.commentId,
      updateCommentDto,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  remove(@Body() input: CommentIdDto) {
    return this.commentService.remove(input.commentId);
  }
}
