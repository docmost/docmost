import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import { AI_CHAT_THROTTLER } from '../../../integrations/throttle/throttler-names';
import { Public } from '../../../common/decorators/public.decorator';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { AuthProviderRepo } from '@docmost/db/repos/auth-provider/auth-provider.repo';
import { SessionService } from '../../session/session.service';
import { TokenService } from '../services/token.service';
import { JwtType } from '../dto/jwt-payload';
import { GoogleOauthService } from './services/google-oauth.service';
import { GoogleGroupsService } from './services/google-groups.service';
import { GoogleProvisioningService } from './services/google-provisioning.service';
import { GoogleCallbackDto, GoogleLoginDto } from './dto/google-sso.dto';
import { safeRedirectPath } from './sso.util';
import { validateAllowedEmail } from '../auth.util';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import { Inject } from '@nestjs/common';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';

@SkipThrottle({ [AI_CHAT_THROTTLER]: true })
@UseGuards(ThrottlerGuard)
@Controller('sso/google')
export class GoogleSsoController {
  private readonly logger = new Logger(GoogleSsoController.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly userRepo: UserRepo,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleGroupsService: GoogleGroupsService,
    private readonly provisioningService: GoogleProvisioningService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @Public()
  @Get('login')
  async login(
    @Query() dto: GoogleLoginDto,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const workspace = await this.workspaceRepo.findById(dto.workspaceId);
    if (!workspace) {
      return this.redirectWithError(res, 'workspace_not_found');
    }

    const provider = await this.authProviderRepo.findGoogleProvider(
      workspace.id,
    );

    if (!provider?.isEnabled || !this.environmentService.isGoogleSsoEnabled()) {
      return this.redirectWithError(res, 'google_sso_disabled');
    }

    const state = await this.tokenService.generateSsoStateToken({
      workspaceId: workspace.id,
      providerId: provider.id,
      redirect: safeRedirectPath(dto.redirect),
      nonce: randomUUID(),
    });

    res.redirect(this.googleOauthService.buildAuthorizationUrl(state), 302);
  }

  @Public()
  @Get('callback')
  async callback(
    @Query() dto: GoogleCallbackDto,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    if (dto.error || !dto.code || !dto.state) {
      return this.redirectWithError(res, 'google_sign_in_cancelled');
    }

    let state: { workspaceId: string; providerId: string; redirect: string };
    try {
      state = await this.tokenService.verifyJwt(dto.state, JwtType.SSO_STATE);
    } catch {
      return this.redirectWithError(res, 'invalid_state');
    }

    const workspace = await this.workspaceRepo.findById(state.workspaceId);
    const provider = workspace
      ? await this.authProviderRepo.findById(state.providerId, workspace.id)
      : null;

    if (!workspace || !provider?.isEnabled) {
      return this.redirectWithError(res, 'google_sso_disabled');
    }

    let identity: Awaited<
      ReturnType<GoogleOauthService['exchangeCode']>
    >;
    try {
      identity = await this.googleOauthService.exchangeCode(dto.code);
    } catch (err: any) {
      this.logger.warn(`Google callback failed: ${err?.message}`);
      return this.redirectWithError(res, 'google_sign_in_failed');
    }

    if (!identity.emailVerified) {
      return this.redirectWithError(res, 'email_not_verified');
    }

    try {
      validateAllowedEmail(identity.email, workspace);
    } catch {
      return this.redirectWithError(res, 'email_domain_not_allowed');
    }

    const user = await this.provisioningService.resolveUser(
      identity,
      provider,
      workspace,
    );

    if (!user) {
      return this.redirectWithError(res, 'signup_not_allowed');
    }

    // Group sync must never be able to block a login.
    if (provider.groupSync) {
      const googleGroups = await this.googleGroupsService.safeListGroupsForUser(
        identity.email,
      );
      if (googleGroups) {
        try {
          await this.provisioningService.syncUser(user, provider, googleGroups);
        } catch (err: any) {
          this.logger.error(
            `Google group sync failed for ${identity.email}: ${err?.message}`,
          );
        }
      }
    }

    // Re-read so the session token carries any role change from sync.
    const freshUser = await this.userRepo.findById(user.id, workspace.id);
    const authToken = await this.sessionService.createSessionAndToken(
      freshUser ?? user,
    );

    await this.userRepo.updateLastLogin(user.id, workspace.id);

    this.auditService.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
    });

    res.setCookie('authToken', authToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });

    const target = safeRedirectPath(state.redirect) ?? '/home';
    res.redirect(`${this.environmentService.getAppUrl()}${target}`, 302);
  }

  private redirectWithError(res: FastifyReply, code: string): void {
    const url = `${this.environmentService.getAppUrl()}/login?error=${encodeURIComponent(code)}`;
    res.redirect(url, 302);
  }
}
