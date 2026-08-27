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
import {
  GoogleProvisioningService,
  PrivilegedLinkBlockedError,
} from './services/google-provisioning.service';
import { GoogleCallbackDto, GoogleLoginDto } from './dto/google-sso.dto';
import { safeRedirectPath } from './sso.util';
import { validateAllowedEmail } from '../auth.util';
import { isUserDisabled } from '../../../common/helpers';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import { Inject } from '@nestjs/common';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';

/** Short-lived cookie binding the OAuth `state` to the browser that began it. */
const SSO_NONCE_COOKIE = 'ssoNonce';

@SkipThrottle({ [AI_CHAT_THROTTLER]: true })
@UseGuards(ThrottlerGuard)
@Controller('sso/google')
export class GoogleSsoController {
  private readonly logger = new Logger(GoogleSsoController.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
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

    const nonce = randomUUID();

    const state = await this.tokenService.generateSsoStateToken({
      workspaceId: workspace.id,
      providerId: provider.id,
      redirect: safeRedirectPath(dto.redirect),
      nonce,
    });

    // Binds the state to THIS browser. Without it, anyone can mint a valid
    // state and feed their own `code` to a victim, silently signing the
    // victim into the attacker's account (login CSRF).
    res.setCookie(SSO_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
      secure: this.environmentService.isHttps(),
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

    let state: {
      workspaceId: string;
      providerId: string;
      redirect: string;
      nonce: string;
    };
    try {
      state = await this.tokenService.verifyJwt(dto.state, JwtType.SSO_STATE);
    } catch {
      return this.redirectWithError(res, 'invalid_state');
    }

    const nonceCookie = req.cookies?.[SSO_NONCE_COOKIE];
    res.clearCookie(SSO_NONCE_COOKIE, { path: '/' });

    if (!nonceCookie || nonceCookie !== state.nonce) {
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

    let user: Awaited<
      ReturnType<GoogleProvisioningService['resolveUser']>
    >;
    try {
      user = await this.provisioningService.resolveUser(
        identity,
        provider,
        workspace,
      );
    } catch (err: any) {
      if (err instanceof PrivilegedLinkBlockedError) {
        return this.redirectWithError(res, 'admin_link_not_allowed');
      }
      throw err;
    }

    if (!user) {
      return this.redirectWithError(res, 'signup_not_allowed');
    }

    if (isUserDisabled(user)) {
      return this.redirectWithError(res, 'account_disabled');
    }

    // MFA is enforced on the password path via the EE module. That module is
    // not reachable from here, so rather than silently issuing a session that
    // skips a second factor, refuse and send the user to password login.
    if (await this.requiresMfa(user.id, workspace)) {
      return this.redirectWithError(res, 'mfa_required');
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

  /**
   * True when this workspace enforces MFA, or the user has a factor enrolled.
   * Either way the Google path must not mint a session on its own.
   */
  private async requiresMfa(
    userId: string,
    workspace: { id: string; enforceMfa?: boolean },
  ): Promise<boolean> {
    if (workspace.enforceMfa) return true;

    const mfa = await this.db
      .selectFrom('userMfa')
      .select('id')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspace.id)
      .where('isEnabled', '=', true)
      .executeTakeFirst();

    return Boolean(mfa);
  }

  private redirectWithError(res: FastifyReply, code: string): void {
    const url = `${this.environmentService.getAppUrl()}/login?error=${encodeURIComponent(code)}`;
    res.redirect(url, 302);
  }
}
