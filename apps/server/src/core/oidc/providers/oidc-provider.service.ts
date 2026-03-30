import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as client from 'openid-client';
import { AuthProvider } from '@docmost/db/types/entity.types';

const OPENID_CONFIGURATION_SUFFIX = '/.well-known/openid-configuration';

@Injectable()
export class OidcProviderService {
  async buildAuthorizationUrl(
    provider: AuthProvider,
    opts: {
      redirectUri: string;
      codeVerifier: string;
      state: string;
    },
  ) {
    const configuration = await this.discover(provider);
    const codeChallenge = await client.calculatePKCECodeChallenge(
      opts.codeVerifier,
    );
    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: opts.redirectUri,
      scope: this.getScope(provider),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: opts.state,
    });

    return { configuration, url };
  }

  async exchangeCode(
    provider: AuthProvider,
    currentUrl: URL,
    opts: { codeVerifier: string; expectedState: string },
  ) {
    const configuration = await this.discover(provider);
    const tokens = await client.authorizationCodeGrant(
      configuration,
      currentUrl,
      {
        pkceCodeVerifier: opts.codeVerifier,
        expectedState: opts.expectedState,
      },
    );

    const userInfoEndpoint = configuration.serverMetadata().userinfo_endpoint;
    if (!userInfoEndpoint || !tokens.access_token) {
      throw new UnauthorizedException('OIDC user info is unavailable');
    }

    const response = await client.fetchProtectedResource(
      configuration,
      tokens.access_token,
      new URL(userInfoEndpoint),
      'GET',
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch OIDC user info');
    }

    const userInfo = (await response.json()) as Record<string, any>;
    return { tokens, userInfo };
  }

  randomCodeVerifier(): string {
    return client.randomPKCECodeVerifier();
  }

  randomState(): string {
    return client.randomState();
  }

  private async discover(provider: AuthProvider) {
    const candidates = this.getDiscoveryCandidates(provider.oidcIssuer);
    let lastIssuerMismatchError: unknown;

    for (const candidate of candidates) {
      try {
        return await client.discovery(
          new URL(candidate),
          provider.oidcClientId,
          provider.oidcClientSecret,
        );
      } catch (error) {
        if (!this.isIssuerMismatchError(error)) {
          throw error;
        }

        lastIssuerMismatchError = error;
      }
    }

    throw lastIssuerMismatchError;
  }

  private getScope(provider: AuthProvider): string {
    if (Array.isArray(provider.scopes) && provider.scopes.length > 0) {
      return provider.scopes.join(' ');
    }

    return 'openid email profile';
  }

  private getDiscoveryCandidates(rawIssuer: string): string[] {
    const normalized = new URL(rawIssuer.trim()).toString();
    const candidates: string[] = [];
    const addCandidate = (value: string) => {
      if (!candidates.includes(value)) {
        candidates.push(value);
      }
    };

    const hasWellKnownSuffix = normalized.includes(OPENID_CONFIGURATION_SUFFIX);

    addCandidate(normalized);

    if (hasWellKnownSuffix) {
      const issuer = normalized.replace(
        new RegExp(`${OPENID_CONFIGURATION_SUFFIX}/?$`),
        '',
      );
      addCandidate(issuer);
      addCandidate(`${issuer}/`);
      return candidates;
    }

    const issuerWithoutTrailingSlash = normalized.endsWith('/')
      ? normalized.slice(0, -1)
      : normalized;
    const issuerWithTrailingSlash = normalized.endsWith('/')
      ? normalized
      : `${normalized}/`;

    addCandidate(issuerWithoutTrailingSlash);
    addCandidate(issuerWithTrailingSlash);
    addCandidate(
      `${issuerWithoutTrailingSlash}${OPENID_CONFIGURATION_SUFFIX}`,
    );

    return candidates;
  }

  private isIssuerMismatchError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      error['code'] === 'OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED'
    );
  }
}
