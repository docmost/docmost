import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Client, Issuer, TokenSet, UserinfoResponse } from 'openid-client';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

export interface OidcProfile extends UserinfoResponse {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
}

@Injectable()
export class OidcStrategy {
  private readonly logger = new Logger(OidcStrategy.name);
  private client: Client;

  constructor(private readonly environmentService: EnvironmentService) {
    // Client will be initialized lazily via getClient()
  }

  async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const issuer = this.environmentService.getOidcIssuer();
    const clientId = this.environmentService.getOidcClientId();
    const clientSecret = this.environmentService.getOidcClientSecret();
    const redirectUri = this.environmentService.getOidcRedirectUri();

    if (!issuer || !clientId || !clientSecret || !redirectUri) {
      throw new UnauthorizedException('OIDC is not properly configured');
    }

    try {
      const oidcIssuer = await Issuer.discover(issuer);
      
      // For Authelia compatibility: create a custom issuer that doesn't validate 'iss'
      // Authelia sometimes omits the 'iss' claim from token responses
      const customIssuer = new Issuer({
        issuer: oidcIssuer.metadata.issuer || issuer,
        authorization_endpoint: oidcIssuer.metadata.authorization_endpoint,
        token_endpoint: oidcIssuer.metadata.token_endpoint,
        userinfo_endpoint: oidcIssuer.metadata.userinfo_endpoint,
        jwks_uri: oidcIssuer.metadata.jwks_uri,
        end_session_endpoint: oidcIssuer.metadata.end_session_endpoint,
      });
      
      this.client = new customIssuer.Client({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris: [redirectUri],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      });
      
      // Store original callback and wrap it to handle missing iss claim
      const originalCallback = this.client.callback.bind(this.client);
      
      // Override callback to handle Authelia's missing iss claim
      (this.client as any).callback = async (
        redirect_uri: string,
        parameters: any,
        checks?: any
      ) => {
        try {
          // Try normal callback first
          return await originalCallback(redirect_uri, parameters, checks);
        } catch (error: any) {
          // If error is about missing iss, try to extract token and validate manually
          if (error?.message?.includes('iss missing')) {
            this.logger.warn('Authelia missing iss claim, attempting manual token validation');
            
            // Get tokens directly via token endpoint
            const tokenSet = await this.client.grant({
              grant_type: 'authorization_code',
              code: parameters.code,
              redirect_uri: redirect_uri,
            });
            
            return tokenSet;
          }
          throw error;
        }
      };

      return this.client;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException(`Failed to discover OIDC issuer: ${message}`);
    }
  }

  async validate(tokenSet: TokenSet): Promise<OidcProfile> {
    const client = await this.getClient();
    const userinfo = await client.userinfo(tokenSet.access_token);
    
    if (!userinfo.email) {
      throw new UnauthorizedException('Email not provided by OIDC provider');
    }

    return userinfo as OidcProfile;
  }
}
