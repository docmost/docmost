import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { User } from '@docmost/db/types/entity.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { UserThrottlerGuard } from '../throttle/user-throttler.guard';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  UNSPLASH_THROTTLER,
} from '../throttle/throttler-names';
import { UnsplashService } from './unsplash.service';
import { ListUnsplashPhotosDto } from './dto/unsplash.dto';

@Controller('unsplash')
export class UnsplashController {
  constructor(
    private readonly unsplashService: UnsplashService,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @SkipThrottle({
    ...ALL_NAMED_THROTTLERS_SKIPPED,
    [UNSPLASH_THROTTLER]: false,
  })
  @Throttle({ [UNSPLASH_THROTTLER]: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('photos')
  async listPhotos(@Body() dto: ListUnsplashPhotosDto, @AuthUser() user: User) {
    // searches spend the shared Unsplash quota, so only page editors run them
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    await this.pageAccessService.validateCanEdit(page, user);

    return this.unsplashService.listPhotos(dto.query ?? '', dto.page ?? 1);
  }
}
