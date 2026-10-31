import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { AuthUser } from '../../../common/decorators/auth-user.decorator.js';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator.js';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import { UnfurlService } from './unfurl.service.js';
import { UnfurlDto } from '../dto/integration.dto.js';
import { UserThrottlerGuard } from '../../../integrations/throttle/user-throttler.guard.js';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  UNFURL_THROTTLER,
} from '../../../integrations/throttle/throttler-names.js';

@Controller('integrations')
export class UnfurlController {
  constructor(private readonly unfurlService: UnfurlService) {}

  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @SkipThrottle({ ...ALL_NAMED_THROTTLERS_SKIPPED, [UNFURL_THROTTLER]: false })
  @Throttle({ [UNFURL_THROTTLER]: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('unfurl')
  async unfurl(
    @Body() dto: UnfurlDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const result = await this.unfurlService.unfurl(
      dto.url,
      user.id,
      workspace.id,
    );
    return { data: result };
  }
}
