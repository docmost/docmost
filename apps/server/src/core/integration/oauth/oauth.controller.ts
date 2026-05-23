import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { OAuthService } from './oauth.service';
import {
  OAuthAuthorizeDto,
  OAuthDisconnectDto,
  OAuthInstallDto,
} from '../dto/integration.dto';
import { IntegrationConnectionService } from '../integration-connection.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Controller('integrations/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('authorize')
  async authorize(
    @Body() dto: OAuthAuthorizeDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { authorizationUrl } = await this.oauthService.getAuthorizationUrl(
      dto.integrationId,
      workspace.id,
      user.id,
    );

    return { authorizationUrl };
  }

  /**
   * Install-and-authorize for workspace-scoped providers (Slack model).
   * Returns the authorize URL without first creating the integration row;
   * the row is created atomically on successful OAuth callback so a cancelled
   * OAuth flow leaves no half-installed state.
   */
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('install')
  async installAndAuthorize(
    @Body() dto: OAuthInstallDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { authorizationUrl } = await this.oauthService.getInstallAuthorizationUrl(
      dto.type,
      workspace.id,
      user.id,
    );

    return { authorizationUrl };
  }

  @Get(':type/callback')
  async callback(
    @Param('type') type: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: FastifyReply,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    const statePayload = this.oauthService.verifySignedState(state);
    if (!statePayload) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    // returnUrl is derived server-side at authorize time from the workspace's
    // own hostname/customDomain (canonical DB truth, not user input), then
    // signed into the state JWT. Safe to use directly here — tampering would
    // invalidate the signature; older tokens predating this field will be
    // undefined and fall back to APP_URL.
    const returnUrl =
      statePayload.returnUrl || this.environmentService.getAppUrl();

    try {
      await this.oauthService.exchangeCodeForTokens(
        type,
        code,
        statePayload.integrationId,
        statePayload.userId,
        statePayload.workspaceId,
      );

      return res.redirect(`${returnUrl}/settings/integrations`, 302).send();
    } catch (err) {
      this.logger.error(`OAuth callback error for ${type}: ${(err as Error).message}`);
      return res
        .redirect(`${returnUrl}/settings/integrations?error=oauth_failed`, 302)
        .send();
    }
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('disconnect')
  async disconnect(
    @Body() dto: OAuthDisconnectDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.connectionService.disconnect(
      dto.integrationId,
      user.id,
      workspace.id,
    );
    return { success: true };
  }
}
