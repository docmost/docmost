import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { FastifyRequest } from 'fastify';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { CommentsInput, SingleCommentInput } from './dto/comments.input';
import { ResolveCommentDto } from './dto/resolve-comment.dto';
import { WorkspaceService } from '../workspace/services/workspace.service';

@UseGuards(JwtGuard)
@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(
    @Req() req: FastifyRequest,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const jwtPayload = req['user'];
    const userId = jwtPayload.sub;

    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;
    return this.commentService.create(userId, workspaceId, createCommentDto);
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
    @Req() req: FastifyRequest,
    @Body() resolveCommentDto: ResolveCommentDto,
  ) {
    const userId = req['user'].sub;
    return this.commentService.resolveComment(userId, resolveCommentDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  remove(@Body() input: SingleCommentInput) {
    return this.commentService.remove(input.id);
  }
}
