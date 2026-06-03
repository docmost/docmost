import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from './services/review.service';
import {
  MarkReviewedDto,
  ReviewScopeDto,
  ReviewSpaceStatusesDto,
  SetReviewDto,
} from './dto/review.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('compliance/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @HttpCode(HttpStatus.OK)
  @Post('get')
  async get(@Body() dto: ReviewScopeDto, @AuthUser() user: User) {
    return this.reviewService.get(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('set')
  async set(
    @Body() dto: SetReviewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.reviewService.set(dto, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-reviewed')
  async markReviewed(
    @Body() dto: MarkReviewedDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.reviewService.markReviewed(dto, user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('statuses')
  async statuses(
    @Body() dto: ReviewSpaceStatusesDto,
    @AuthUser() user: User,
  ) {
    return this.reviewService.getStatuses(dto.spaceId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('history')
  async history(
    @Body() dto: ReviewScopeDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    return this.reviewService.history(dto, pagination, user);
  }
}
