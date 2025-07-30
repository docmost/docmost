import { Controller, Get, Post, Query, Body, Res, HttpCode, HttpStatus, BadRequestException, Req } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, createHmac } from 'crypto';
import { OidcService } from '../services/oidc.service';
import { OidcConfigService } from '../services/oidc-config.service';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { AuthService } from '../services/auth.service';

const stateStore = new Map<string, { workspaceId: string; timestamp: number }>();

// TODO: Use redis
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 1000;
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > maxAge) {
      stateStore.delete(state);
    }
  }
}, 60 * 1000);

@Controller('auth/oidc')
export class OidcController {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly oidcService: OidcService,
    private readonly oidcConfigService: OidcConfigService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.allowedOrigins = [this.environmentService.getAppUrl()];
  }

  private validateRedirectUri(redirectUri: string): boolean {
    try {
      const url = new URL(redirectUri);
      return this.allowedOrigins.some(origin => redirectUri.startsWith(origin));
    } catch {
      return false;
    }
  }

  @Get('authorize')
  async authorize(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;
    
    if (!this.validateRedirectUri(redirectUri)) {
      throw new BadRequestException('Invalid redirect URI');
    }
    
    const { url, state } = await this.oidcService.getAuthorizationUrl(workspace.id, redirectUri);
    
    stateStore.set(state, { workspaceId: workspace.id, timestamp: Date.now() });

    return { url };
  }

  @Post('callback')
  async callback(
    @AuthWorkspace() workspace: Workspace,
    @Body('code') code: string,
    @Body('state') state: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    if (code.length < 10 || code.length > 1000) {
      throw new BadRequestException('Invalid code parameter format');
    }

    const storedState = stateStore.get(state);
    if (!storedState || storedState.workspaceId !== workspace.id) {
      throw new BadRequestException('Invalid or expired state parameter');
    }

    stateStore.delete(state);

    try {
      const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;
      
      if (!this.validateRedirectUri(redirectUri)) {
        throw new BadRequestException('Invalid redirect URI');
      }
      
      const { token } = await this.oidcService.handleCallback(workspace.id, code, state, redirectUri);
      
      this.setAuthCookie(res, token);
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  @Get('config')
  async getConfig(@AuthWorkspace() workspace: Workspace) {
    return {
      buttonText: this.oidcConfigService.getOidcButtonText(),
      autoRedirect: this.oidcConfigService.getOidcAutoRedirect(),
    };
  }

  setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
