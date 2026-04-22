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
  private oidcConfigPromise?: Promise<oidc.Configuration>;
  private oidcConfigExpiresAt = 0;

  constructor(private readonly environmentService: EnvironmentService) {}

  generatePkceCodeVerifier() {
    return oidc.randomPKCECodeVerifier();
  }

  async buildLoginUrl(state: string, nonce: string, codeVerifier: string) {
    const config = await this.getOidcConfig();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    return oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.environmentService.getOAuthCallbackUrl(),
      response_type: 'code',
      scope: this.environmentService.getOAuthScopes(),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async getProfileFromCallback(
    req: FastifyRequest,
    expectedState: string,
    expectedNonce: string,
    pkceCodeVerifier: string,
  ): Promise<OAuthProfile> {
    const config = await this.getOidcConfig();
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

    const email =
      this.getClaimValue(userInfo?.email) ??
      this.getClaimValue(idTokenClaims?.email);
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

  private async getOidcConfig() {
    if (this.oidcConfigPromise && this.oidcConfigExpiresAt > Date.now()) {
      return this.oidcConfigPromise;
    }

    this.oidcConfigPromise = oidc.discovery(
      new URL(this.environmentService.getOAuthIssuerUrl()),
      this.environmentService.getOAuthClientId(),
      {
        redirect_uris: [this.environmentService.getOAuthCallbackUrl()],
        response_types: ['code'],
      },
      oidc.ClientSecretPost(this.environmentService.getOAuthClientSecret()),
      {
        execute: this.shouldAllowInsecureRequests()
          ? [oidc.allowInsecureRequests]
          : undefined,
      },
    );
    this.oidcConfigExpiresAt = Date.now() + OAUTH_CONFIG_TTL_MS;

    try {
      return await this.oidcConfigPromise;
    } catch (error) {
      this.oidcConfigPromise = undefined;
      this.oidcConfigExpiresAt = 0;
      throw error;
    }
  }

  private shouldAllowInsecureRequests() {
    return (
      this.environmentService.getOAuthIssuerUrl()?.startsWith('http://') ||
      this.environmentService.getOAuthCallbackUrl()?.startsWith('http://')
    );
  }

  private getCurrentUrl(req: FastifyRequest) {
    return new URL(req.raw.url || req.url, this.environmentService.getAppUrl());
  }

  private getClaimValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
