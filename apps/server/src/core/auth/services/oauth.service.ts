import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import * as oidc from 'openid-client';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

const OAUTH_CONFIG_TTL_MS = 5 * 60 * 1000;

type OAuthProfile = {
  email: string;
  name?: string;
  avatarUrl?: string;
};

@Injectable()
export class OauthService {
  private oidcConfigByProvider = new Map<
    string,
    {
      promise: Promise<oidc.Configuration>;
      expiresAt: number;
    }
  >();

  constructor(private readonly environmentService: EnvironmentService) {}

  generatePkceCodeVerifier() {
    return oidc.randomPKCECodeVerifier();
  }

  async buildLoginUrl(
    provider: string,
    state: string,
    nonce: string,
    codeVerifier: string,
  ) {
    const config = await this.getOidcConfig(provider);
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.environmentService.getOAuthCallbackUrl(provider),
      response_type: 'code',
      scope: this.environmentService.getOAuthScopes(provider),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async getProfileFromCallback(
    provider: string,
    req: FastifyRequest,
    expectedState: string,
    expectedNonce: string,
    pkceCodeVerifier: string,
  ): Promise<OAuthProfile> {
    const config = await this.getOidcConfig(provider);
    const currentUrl = this.getCurrentUrl(req);

    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      expectedState,
      expectedNonce,
      pkceCodeVerifier,
    });

    const idTokenClaims = tokens.claims();
    const expectedSubject = idTokenClaims?.sub ?? oidc.skipSubjectCheck;

    let userInfo: oidc.UserInfoResponse | undefined;
    if (tokens.access_token) {
      try {
        userInfo = await oidc.fetchUserInfo(
          config,
          tokens.access_token,
          expectedSubject,
        );
      } catch (error) {
        userInfo = undefined;
      }
    }

    const email = this.getEmail(provider, userInfo, idTokenClaims);
    if (!email) {
      throw new UnauthorizedException(
        'OAuth provider did not return an email address',
      );
    }

    const name =
      this.getClaimValue(userInfo?.name) ??
      this.getClaimValue(userInfo?.preferred_username) ??
      this.getClaimValue(idTokenClaims?.name) ??
      this.getClaimValue(idTokenClaims?.preferred_username);
    const avatarUrl =
      this.getClaimValue(userInfo?.picture) ??
      this.getClaimValue(idTokenClaims?.picture);

    return {
      email,
      name,
      avatarUrl,
    };
  }

  private async getOidcConfig(provider: string) {
    const cachedConfig = this.oidcConfigByProvider.get(provider);
    if (cachedConfig && cachedConfig.expiresAt > Date.now()) {
      return cachedConfig.promise;
    }

    const configPromise = oidc.discovery(
      new URL(this.environmentService.getOAuthIssuerUrl(provider)),
      this.environmentService.getOAuthClientId(provider),
      {
        redirect_uris: [this.environmentService.getOAuthCallbackUrl(provider)],
        response_types: ['code'],
      },
      oidc.ClientSecretPost(
        this.environmentService.getOAuthClientSecret(provider),
      ),
      {
        execute: this.shouldAllowInsecureRequests(provider)
          ? [oidc.allowInsecureRequests]
          : undefined,
      },
    );
    this.oidcConfigByProvider.set(provider, {
      promise: configPromise,
      expiresAt: Date.now() + OAUTH_CONFIG_TTL_MS,
    });

    try {
      return await configPromise;
    } catch (error) {
      this.oidcConfigByProvider.delete(provider);
      throw error;
    }
  }

  private shouldAllowInsecureRequests(provider: string) {
    return (
      this.environmentService
        .getOAuthIssuerUrl(provider)
        ?.startsWith('http://') ||
      this.environmentService
        .getOAuthCallbackUrl(provider)
        ?.startsWith('http://')
    );
  }

  private getCurrentUrl(req: FastifyRequest) {
    return new URL(req.raw.url || req.url, this.environmentService.getAppUrl());
  }

  private getClaimValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private getEmail(
    provider: string,
    userInfo?: oidc.UserInfoResponse,
    idTokenClaims?: oidc.IDToken,
  ) {
    const email =
      this.getClaimValue(userInfo?.email) ??
      this.getClaimValue(idTokenClaims?.email);

    if (email || provider !== 'azure') {
      return email;
    }

    return (
      this.getClaimValue(userInfo?.preferred_username) ??
      this.getClaimValue(userInfo?.upn) ??
      this.getClaimValue(idTokenClaims?.preferred_username) ??
      this.getClaimValue(idTokenClaims?.upn)
    );
  }
}
