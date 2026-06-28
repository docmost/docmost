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
import { SsoService } from './sso.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @HttpCode(HttpStatus.OK)
  @Post('providers')
  @RequireFeature(Feature.SSO_CUSTOM)
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.list(workspace.id, user, workspace, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  @RequireFeature(Feature.SSO_CUSTOM)
  async info(
    @Body() body: { providerId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.getById(
      body.providerId,
      workspace.id,
      user,
      workspace,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @RequireFeature(Feature.SSO_CUSTOM)
  async create(
    @Body() body: Record<string, unknown>,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.create(workspace.id, user, workspace, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @RequireFeature(Feature.SSO_CUSTOM)
  async update(
    @Body() body: Record<string, unknown>,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.update(workspace.id, user, workspace, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  @RequireFeature(Feature.SSO_CUSTOM)
  async delete(
    @Body() body: { providerId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.ssoService.delete(
      body.providerId,
      workspace.id,
      user,
      workspace,
    );
  }
}
