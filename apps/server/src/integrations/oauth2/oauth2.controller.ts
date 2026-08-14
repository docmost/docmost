import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { Oauth2Service } from './oauth2.service';
import { Oauth2CallbackDto, Oauth2ConfigDto } from './dto/oauth2.dto';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

// Generic OAuth2 endpoints; the provider is a route param resolved against the
// registry, so a new integration needs no new connection/config endpoints.
@UseGuards(JwtAuthGuard)
@Controller('integrations/oauth2/:provider')
export class Oauth2Controller {
  constructor(
    private readonly oauth2Service: Oauth2Service,
    private readonly environmentService: EnvironmentService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  private assertCanManageSettings(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('authorize')
  async authorize(
    @Param('provider') provider: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.oauth2Service.getProviderOrThrow(provider);
    const url = await this.oauth2Service.buildAuthorizeUrl(
      provider,
      user.id,
      workspace.id,
    );
    return { url };
  }

  @SkipTransform()
  @Get('callback')
  async callback(
    @Param('provider') provider: string,
    @Query() query: Oauth2CallbackDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    const base = `${this.environmentService.getAppUrl()}/settings/integrations`;
    const redirectTo = (status: 'connected' | 'error') =>
      res.redirect(`${base}?integration=${provider}&status=${status}`, 302);

    if (
      !this.oauth2Service.hasProvider(provider) ||
      query.error ||
      !query.code ||
      !this.oauth2Service.verifyState(
        query.state,
        provider,
        user.id,
        workspace.id,
      )
    ) {
      return redirectTo('error');
    }

    try {
      await this.oauth2Service.handleCallback(
        provider,
        query.code,
        user.id,
        workspace.id,
      );
      return redirectTo('connected');
    } catch {
      return redirectTo('error');
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('status')
  async status(
    @Param('provider') provider: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.oauth2Service.getProviderOrThrow(provider);
    const [status, configured] = await Promise.all([
      this.oauth2Service.getStatus(provider, user.id, workspace.id),
      this.oauth2Service.isConfigured(workspace.id, provider),
    ]);
    return { ...status, configured };
  }

  @HttpCode(HttpStatus.OK)
  @Post('disconnect')
  async disconnect(
    @Param('provider') provider: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.oauth2Service.getProviderOrThrow(provider);
    await this.oauth2Service.disconnect(provider, user.id, workspace.id);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('config')
  async getConfig(
    @Param('provider') provider: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManageSettings(user, workspace);
    this.oauth2Service.getProviderOrThrow(provider);
    return this.oauth2Service.getAppConfig(workspace.id, provider);
  }

  @HttpCode(HttpStatus.OK)
  @Post('config/set')
  async setConfig(
    @Param('provider') provider: string,
    @Body() dto: Oauth2ConfigDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManageSettings(user, workspace);
    this.oauth2Service.getProviderOrThrow(provider);
    await this.oauth2Service.setAppConfig(
      workspace.id,
      provider,
      dto.clientId,
      dto.clientSecret,
    );
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('config/delete')
  async deleteConfig(
    @Param('provider') provider: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManageSettings(user, workspace);
    this.oauth2Service.getProviderOrThrow(provider);
    await this.oauth2Service.deleteAppConfig(workspace.id, provider);
    return { success: true };
  }
}
