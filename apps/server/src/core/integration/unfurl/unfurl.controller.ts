import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UnfurlService } from './unfurl.service';
import { UnfurlDto } from '../dto/integration.dto';
import { UserThrottlerGuard } from '../../../integrations/throttle/user-throttler.guard';
import {
  ALL_NAMED_THROTTLERS_SKIPPED,
  UNFURL_THROTTLER,
} from '../../../integrations/throttle/throttler-names';

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
