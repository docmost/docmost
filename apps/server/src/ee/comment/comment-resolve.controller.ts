import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CommentResolveService } from './comment-resolve.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentResolveController {
  constructor(private readonly commentResolveService: CommentResolveService) {}

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  @RequireFeature(Feature.COMMENT_RESOLUTION)
  async resolve(
    @Body() body: { commentId: string; pageId: string; resolved: boolean },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.commentResolveService.resolve(body, user, workspace.id);
  }
}
