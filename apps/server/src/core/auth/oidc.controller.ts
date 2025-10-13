import {
  Controller,
  Get,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { OidcService } from './services/oidc.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { nanoid } from 'nanoid';

@Controller('auth/oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);
  private stateStore = new Map<string, { workspaceId: string; timestamp: number }>();

  constructor(
    private readonly oidcService: OidcService,
    private readonly environmentService: EnvironmentService,
  ) {
    // Clean up expired states every 10 minutes
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  private cleanupExpiredStates() {
    const now = Date.now();
    const expirationTime = 10 * 60 * 1000; // 10 minutes

    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > expirationTime) {
        this.stateStore.delete(state);
      }
    }
  }

  @Get('login')
  async login(
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    if (!this.oidcService.isOidcEnabled()) {
      throw new BadRequestException('OIDC authentication is not configured');
    }

    try {
      // Generate state for CSRF protection
      const state = nanoid(32);
      this.stateStore.set(state, {
        workspaceId: workspace.id,
        timestamp: Date.now(),
      });

      const authUrl = await this.oidcService.getAuthorizationUrl(state);

      this.logger.log(`Redirecting to OIDC provider for workspace: ${workspace.id}`);
      
      return res.redirect(authUrl, HttpStatus.FOUND);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`OIDC login error: ${message}`, stack);
      throw new BadRequestException(`Failed to initiate OIDC login: ${message}`);
    }
  }

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    // Verify state and retrieve workspace
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new UnauthorizedException('Invalid or expired state parameter');
    }

    const { workspaceId } = stateData;
    this.stateStore.delete(state); // Use state only once

    try {
      const { authToken } = await this.oidcService.handleCallback(
        code,
        state,
        workspaceId,
      );

      // Set auth cookie
      this.setAuthCookie(res, authToken);

      // Redirect to home page
      const appUrl = this.environmentService.getAppUrl();
      return res.redirect(`${appUrl}/home`, HttpStatus.FOUND);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`OIDC callback error: ${message}`, stack);
      
      // Redirect to login with error
      const appUrl = this.environmentService.getAppUrl();
      return res.redirect(
        `${appUrl}/login?error=${encodeURIComponent(message)}`,
        HttpStatus.FOUND,
      );
    }
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async status() {
    return {
      enabled: this.oidcService.isOidcEnabled(),
      autoProvision: this.environmentService.isOidcAutoProvision(),
    };
  }

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
