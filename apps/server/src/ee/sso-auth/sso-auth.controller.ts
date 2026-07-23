import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
  private readonly logger = new Logger(SsoAuthController.name);

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

  // Singleton Entra ID (Azure AD) routes: no providerId path segment, since
  // Entra app registrations require a fixed, exact redirect URI. The
  // provider is instead resolved by workspace (see
  // AuthProviderRepo.findEntraProvider). Must stay registered before the
  // generic ':providerId'-scoped routes below are matched by Nest, though
  // segment-count alone already disambiguates them ('oidc/login' vs
  // 'oidc/:providerId/login').
  @Get('oidc/login')
  async oidcEntraLogin(
    @Query('redirect') redirect: string | undefined,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.startOidcLogin(undefined, redirect, workspace, res);
  }

  @Get('oidc/callback')
  async oidcEntraCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    return this.finishOidcLogin(code, state, workspace, res, req);
  }

  @Get('oidc/:providerId/login')
  async oidcLogin(
    @Param('providerId') providerId: string,
    @Query('redirect') redirect: string | undefined,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.startOidcLogin(providerId, redirect, workspace, res);
  }

  @Get('oidc/:providerId/callback')
  async oidcCallback(
    @Param('providerId') _providerId: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Req() req: FastifyRequest,
  ) {
    return this.finishOidcLogin(code, state, workspace, res, req);
  }

  private async startOidcLogin(
    providerId: string | undefined,
    redirect: string | undefined,
    workspace: Workspace,
    res: FastifyReply,
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
    // Do NOT `return res.redirect(url)` here: Fastify's reply.redirect()
    // returns `this` (the reply instance), and with @Res({passthrough:true})
    // Nest treats any non-undefined return value as a body to additionally
    // send, re-serializing the response with its own default 200 status -
    // silently overwriting the 302 + Location header redirect() already set,
    // so the browser receives 200 OK with a Location header it never
    // follows (this is exactly the "blank white screen" bug). Call
    // redirect() as a side effect and return nothing.
    res.redirect(url);
  }

  private async finishOidcLogin(
    code: string,
    state: string,
    workspace: Workspace,
    res: FastifyReply,
    req: FastifyRequest,
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
      // See the comment in startOidcLogin: do not return the redirect() call.
      res.redirect(`${appUrl}${redirect ?? '/'}`);
    } catch (error) {
      this.logger.error(
        `OIDC callback failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      res.clearCookie('oidc_state', { path: '/' });
      res.redirect(`${appUrl}/login?error=sso_failed`);
    }
  }
}
