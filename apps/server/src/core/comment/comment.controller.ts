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
import { CommentsInput, SingleCommentInput } from './dto/comments.input';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

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
  findPageComments(@Body() input: CommentsInput) {
    return this.commentService.findByPageId(input.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  findOne(@Body() input: SingleCommentInput) {
    return this.commentService.findWithCreator(input.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(@Body() updateCommentDto: UpdateCommentDto) {
    return this.commentService.update(updateCommentDto.id, updateCommentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  resolve(
    @Body() resolveCommentDto: ResolveCommentDto,
    @AuthUser() user: User,
  ) {
    return this.commentService.resolveComment(user.id, resolveCommentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  remove(@Body() input: SingleCommentInput) {
    return this.commentService.remove(input.id);
  }
}
