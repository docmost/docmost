import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequireSessionAuth } from '../../common/decorators/require-session-auth.decorator';
import { UserThrottlerGuard } from '../throttle/user-throttler.guard';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  LINK_PREVIEW_THROTTLER,
} from '../throttle/throttler-names';
import { LinkPreviewService } from './link-preview.service';
import { LinkPreviewDto } from './dto/link-preview.dto';
import { LinkPreview } from './link-preview.types';

@Controller('links')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @RequireSessionAuth()
  @SkipThrottle({
    ...ALL_NAMED_THROTTLERS_SKIPPED,
    [LINK_PREVIEW_THROTTLER]: false,
  })
  @Throttle({ [LINK_PREVIEW_THROTTLER]: { limit: 30, ttl: 60_000 } })
  @Post('preview')
  async preview(@Body() dto: LinkPreviewDto): Promise<LinkPreview | null> {
    return this.linkPreviewService.getPreview(dto.url, {
      refresh: dto.refresh,
    });
  }
}
