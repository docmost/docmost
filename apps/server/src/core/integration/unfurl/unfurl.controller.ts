import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UnfurlService } from './unfurl.service';
import { UnfurlDto } from '../dto/integration.dto';

@Controller('integrations')
export class UnfurlController {
  constructor(private readonly unfurlService: UnfurlService) {}

  @UseGuards(JwtAuthGuard)
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
