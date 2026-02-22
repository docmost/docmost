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
import { OAuthAuthorizeDto, OAuthDisconnectDto } from '../dto/integration.dto';
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

    try {
      await this.oauthService.exchangeCodeForTokens(
        type,
        code,
        statePayload.integrationId,
        statePayload.userId,
        statePayload.workspaceId,
      );

      const appUrl = this.environmentService.getAppUrl();
      return res.redirect(`${appUrl}/settings/integrations`, 302).send();
    } catch (err) {
      this.logger.error(`OAuth callback error for ${type}: ${(err as Error).message}`);
      const appUrl = this.environmentService.getAppUrl();
      return res.redirect(`${appUrl}/settings/integrations?error=oauth_failed`, 302).send();
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
