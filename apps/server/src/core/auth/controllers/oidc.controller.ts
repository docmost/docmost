import { Controller, Get, Post, Query, Body, Res, HttpCode, HttpStatus, BadRequestException, Req } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { OidcService } from '../services/oidc.service';
import { OidcConfigService } from '../services/oidc-config.service';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Controller('auth/oidc')
export class OidcController {
  constructor(
    private readonly oidcService: OidcService,
    private readonly oidcConfigService: OidcConfigService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Get('authorize')
  async authorize(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;
    const { url, state } = await this.oidcService.getAuthorizationUrl(workspace.id, redirectUri);
    
    res.clearCookie('oidc_state');
    
    res.setCookie('oidc_state', state, {
      httpOnly: true,
      secure: this.environmentService.isHttps(),
      sameSite: 'lax',
      maxAge: 300000,
    });

    return { url };
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

    const storedState = req.cookies.oidc_state;
    if (!storedState || state !== storedState) {
      throw new BadRequestException('Invalid state parameter');
    }

    try {
      const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;
      
      const { token } = await this.oidcService.handleCallback(workspace.id, code, redirectUri);

      res.clearCookie('oidc_state');
      
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

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
