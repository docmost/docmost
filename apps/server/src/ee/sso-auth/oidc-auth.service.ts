import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as client from 'openid-client';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { encodeOidcState, decodeOidcState } from './oidc-state.util';
import { UserRole } from '../../common/helpers/types/permission';
import { nanoIdGen } from '../../common/helpers';

@Injectable()
export class OidcAuthService {
  constructor(
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly userRepo: UserRepo,
    private readonly sessionService: SessionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  private buildCallbackUrl(providerId?: string): string {
    const base = `${this.environmentService.getAppUrl()}/api/sso/oidc`;
    return providerId ? `${base}/${providerId}/callback` : `${base}/callback`;
  }

  private isOidcCapable(provider: { type: string } | undefined): boolean {
    return provider?.type === 'oidc' || provider?.type === 'azure-ad';
  }

  /**
   * providerId is omitted for the singleton Entra ID (Azure AD) flow, whose
   * redirect URI is fixed (no dynamic segment, since Entra app registrations
   * pin an exact callback URL) - the actual provider is resolved by
   * workspace instead. It is always present for the generic, providerId-
   * scoped OIDC flow.
   */
  async buildAuthorizationUrl(
    providerId: string | undefined,
    workspaceId: string,
    redirect?: string,
  ): Promise<{ url: string; stateCookie: string }> {
    const provider = providerId
      ? await this.authProviderRepo.findById(providerId, workspaceId)
      : await this.authProviderRepo.findEntraProvider(workspaceId);
    if (!provider || !provider.isEnabled || !this.isOidcCapable(provider)) {
      throw new NotFoundException('SSO provider not found');
    }
    if (
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    ) {
      throw new BadRequestException('OIDC provider is not fully configured');
    }

    const config = await client.discovery(
      new URL(provider.oidcIssuer),
      provider.oidcClientId,
      provider.oidcClientSecret,
    );

    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    // The redirect_uri shape (singleton vs providerId-scoped) mirrors how
    // this authorization request was reached, not how the provider was
    // resolved - the singleton /callback route always issues a singleton
    // redirect_uri, matching the fixed URI registered in Entra.
    const callbackUrl = this.buildCallbackUrl(providerId);
    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const stateCookie = encodeOidcState(
      {
        providerId: provider.id,
        nonce,
        state,
        redirect,
        codeVerifier,
        singleton: providerId === undefined,
      },
      this.environmentService.getAppSecret(),
    );

    return { url: authUrl.href, stateCookie };
  }

  async handleCallback(params: {
    code: string;
    state: string;
    stateCookie: string;
    workspaceId: string;
  }): Promise<{ authToken: string; redirect?: string }> {
    const decoded = decodeOidcState(
      params.stateCookie,
      this.environmentService.getAppSecret(),
    );
    if (!decoded || decoded.state !== params.state || !decoded.codeVerifier) {
      throw new BadRequestException('Invalid or expired SSO state');
    }

    const provider = await this.authProviderRepo.findById(
      decoded.providerId,
      params.workspaceId,
    );
    if (!provider || !provider.isEnabled || !this.isOidcCapable(provider)) {
      throw new NotFoundException('SSO provider not found');
    }
    if (
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    ) {
      throw new BadRequestException('OIDC provider is not fully configured');
    }

    const config = await client.discovery(
      new URL(provider.oidcIssuer),
      provider.oidcClientId,
      provider.oidcClientSecret,
    );

    // Reconstructs the exact redirect_uri sent in the authorization request
    // (required for the token exchange to match per the OAuth spec) - based
    // on how this cycle was STARTED (decoded.singleton), not on whether a
    // providerId happens to be known now.
    const callbackUrl = this.buildCallbackUrl(
      decoded.singleton ? undefined : decoded.providerId,
    );
    const currentUrl = new URL(callbackUrl);
    currentUrl.searchParams.set('code', params.code);
    currentUrl.searchParams.set('state', params.state);

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: decoded.codeVerifier,
      expectedState: decoded.state,
      expectedNonce: decoded.nonce,
    });

    // The email/name claims come from the ID token returned by openid-client's
    // authorizationCodeGrant, which already performs full OIDC validation
    // (signature, issuer, audience, expiry) regardless of the issuer - Entra ID
    // included. There is no Entra-specific config (tenantId, group sync rules,
    // etc.) wired up from the AuthProviders row today, so no additional
    // provider-specific handling is applied here.
    const claims = tokens.claims();
    // Azure AD only guarantees `preferred_username`; the `email` claim is
    // only emitted when the optional claim is configured on the app
    // registration and the user has a verified email on that domain.
    const email =
      (claims?.email as string | undefined) ??
      (claims?.preferred_username as string | undefined);
    const name = (claims?.name as string | undefined) ?? email;

    if (!email) {
      throw new BadRequestException('SSO provider did not return an email claim');
    }

    // Mirrors SsoAuthService.ldapLogin's find-or-provision-by-email flow.
    let user = await this.userRepo.findByEmail(email, params.workspaceId);
    if (!user && provider.allowSignup) {
      user = await this.userRepo.insertUser({
        email,
        name: name || email,
        password: nanoIdGen(16),
        workspaceId: params.workspaceId,
        role: UserRole.MEMBER,
      });
    }
    if (!user) {
      throw new UnauthorizedException('User not provisioned');
    }

    const authToken = await this.sessionService.createSessionAndToken(user);
    const redirect = isSafeRedirectPath(decoded.redirect)
      ? decoded.redirect
      : '/';
    return { authToken, redirect };
  }
}

/**
 * Validates that a post-login redirect target is a safe, same-origin relative
 * path - rejecting anything that could be interpreted by a browser as
 * pointing to a different host (open redirect), such as protocol-relative
 * URLs (`//evil.com`), values containing a scheme (`http://evil.com`),
 * userinfo-style hosts (`@evil.com`), or backslashes (`\evil.com`, which some
 * browsers normalize like forward slashes).
 */
export function isSafeRedirectPath(path: string | undefined): path is string {
  if (!path) {
    return false;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false;
  }
  if (path.includes('\\') || path.includes('@')) {
    return false;
  }
  return true;
}
