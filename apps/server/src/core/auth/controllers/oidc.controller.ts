import { Controller, Get, Post, Query, Body, Res, HttpCode, HttpStatus, BadRequestException, Req } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes, createHash } from 'crypto';
import { OidcService } from '../services/oidc.service';
import { OidcConfigService } from '../services/oidc-config.service';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

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
    
    const state = randomBytes(32).toString('hex');
    const stateHash = createHash('sha256').update(state).digest('hex');
    
    const { url } = await this.oidcService.getAuthorizationUrl(workspace.id, redirectUri);
    const fullUrl = `${url}&state=${state}`;
    
    res.clearCookie('oidc_state');
    
    res.setCookie('oidc_state', stateHash, {
      httpOnly: true,
      secure: this.environmentService.isHttps(),
      sameSite: 'strict',
      maxAge: 60000,
    });

    return { url: fullUrl };
  }

  @Get('callback')
  async callback(
    @AuthWorkspace() workspace: Workspace,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    if (code.length < 10 || code.length > 1000) {
      throw new BadRequestException('Invalid code parameter format');
    }

    if (state.length !== 64) {
      throw new BadRequestException('Invalid state parameter format');
    }

    const storedStateHash = req.cookies.oidc_state;
    if (!storedStateHash) {
      throw new BadRequestException('Missing state cookie');
    }

    const stateHash = createHash('sha256').update(state).digest('hex');
    if (stateHash !== storedStateHash) {
      throw new BadRequestException('Invalid state parameter');
    }

    try {
      const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;
      
      if (!this.validateRedirectUri(redirectUri)) {
        throw new BadRequestException('Invalid redirect URI');
      }
      
      const { token } = await this.oidcService.handleCallback(workspace.id, code, redirectUri);

      res.clearCookie('oidc_state');
      
      this.setAuthCookie(res, token);
      
      return { success: true };
    } catch (error) {
      res.clearCookie('oidc_state');
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

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
      sameSite: 'strict',
    });
  }
}
