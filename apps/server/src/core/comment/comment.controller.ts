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
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CommentsInput, SingleCommentInput } from './dto/comments.input';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { CurrentWorkspace } from '../../decorators/current-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.commentService.create(user.id, workspace.id, createCommentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  findPageComments(@Body() input: CommentsInput) {
    return this.commentService.findByPageId(input.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('view')
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
