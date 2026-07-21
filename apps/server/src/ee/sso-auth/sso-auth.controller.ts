import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { SsoAuthService } from './sso-auth.service';
import { OidcAuthService } from './oidc-auth.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Controller('sso')
export class SsoAuthController {
  constructor(
    private readonly ssoAuthService: SsoAuthService,
    private readonly oidcAuthService: OidcAuthService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('ldap/:providerId/login')
  async ldapLogin(
    @Param('providerId') providerId: string,
    @Body() body: { username: string; password: string },
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const authToken = await this.ssoAuthService.ldapLogin(
      providerId,
      body,
      workspace.id,
    );
    res.setCookie('authToken', authToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
    return {};
  }

  @Get('oidc/:providerId/login')
  async oidcLogin(
    @Param('providerId') providerId: string,
    @Query('redirect') redirect: string | undefined,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { url, stateCookie } =
      await this.oidcAuthService.buildAuthorizationUrl(
        providerId,
        workspace.id,
        redirect,
      );
    res.setCookie('oidc_state', stateCookie, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return res.redirect(url);
  }

  @Get('oidc/:providerId/callback')
  async oidcCallback(
    @Param('providerId') providerId: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    const appUrl = this.environmentService.getAppUrl();
    const stateCookie = req.cookies?.['oidc_state'];
    try {
      if (!code || !state || !stateCookie) {
        throw new Error('Missing OIDC callback parameters');
      }
      const { authToken, redirect } = await this.oidcAuthService.handleCallback({
        code,
        state,
        stateCookie,
        workspaceId: workspace.id,
      });
      res.setCookie('authToken', authToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: this.environmentService.getCookieExpiresIn(),
        secure: this.environmentService.isHttps(),
      });
      res.clearCookie('oidc_state', { path: '/' });
      return res.redirect(`${appUrl}${redirect ?? '/'}`);
    } catch {
      res.clearCookie('oidc_state', { path: '/' });
      return res.redirect(`${appUrl}/login?error=sso_failed`);
    }
  }
}
