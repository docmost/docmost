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
import { runHook } from '../../core/plugins/run-hook';
import { CoreHooks } from '../../core/plugins/plugin-hooks';
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

  private isEntraIssuer(issuer: string): boolean {
    return issuer.includes('login.microsoftonline.com');
  }

  private buildCallbackUrl(providerId: string): string {
    return `${this.environmentService.getAppUrl()}/api/sso/oidc/${providerId}/callback`;
  }

  async buildAuthorizationUrl(
    providerId: string,
    workspaceId: string,
    redirect?: string,
  ): Promise<{ url: string; stateCookie: string }> {
    const provider = await this.authProviderRepo.findById(
      providerId,
      workspaceId,
    );
    if (!provider || !provider.isEnabled || provider.type !== 'oidc') {
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
      { providerId, nonce, state, redirect, codeVerifier },
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
    if (!provider || !provider.isEnabled || provider.type !== 'oidc') {
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

    const callbackUrl = this.buildCallbackUrl(decoded.providerId);
    const currentUrl = new URL(callbackUrl);
    currentUrl.searchParams.set('code', params.code);
    currentUrl.searchParams.set('state', params.state);

    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: decoded.codeVerifier,
      expectedState: decoded.state,
      expectedNonce: decoded.nonce,
    });

    const claims = tokens.claims();
    let email = claims?.email as string | undefined;
    let name = (claims?.name as string | undefined) ?? email;

    if (provider.oidcIssuer && this.isEntraIssuer(provider.oidcIssuer)) {
      const hookResult = await runHook(CoreHooks.OIDC_LOGIN, {
        providerId: decoded.providerId,
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
        workspaceId: params.workspaceId,
        config: provider,
      });
      const userInfo = (hookResult as any)?.userInfo;
      if (userInfo?.email) {
        // Safe to override the verified ID-token email here: AuthOidcLoginHandler.handle
        // (apps/server/src/ee/plugins/azure-ad/hooks/auth-oidc-login.handler.ts) re-verifies
        // the ID token's signature (verifyTokenSignature) and claims (validateToken) before
        // deriving userInfo whenever `config` is provided - which it always is on this path
        // (config: provider is passed above) - so userInfo.email is itself cryptographically
        // verified, not blindly trusted.
        email = userInfo.email;
        name = userInfo.name ?? name;
      }
    }

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
    return { authToken, redirect: decoded.redirect };
  }
}
