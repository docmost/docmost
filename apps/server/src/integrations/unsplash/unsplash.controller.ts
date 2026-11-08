import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserThrottlerGuard } from '../throttle/user-throttler.guard';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  UNSPLASH_THROTTLER,
} from '../throttle/throttler-names';
import { UnsplashService } from './unsplash.service';
import { ListUnsplashPhotosDto } from './dto/unsplash.dto';

@Controller('unsplash')
export class UnsplashController {
  constructor(private readonly unsplashService: UnsplashService) {}

  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [UNSPLASH_THROTTLER]: false })
  @Throttle({ [UNSPLASH_THROTTLER]: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('photos')
  async listPhotos(@Body() dto: ListUnsplashPhotosDto) {
    return this.unsplashService.listPhotos(dto.query ?? '', dto.page ?? 1);
  }
}
