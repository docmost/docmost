import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OidcStrategy, OidcProfile } from '../strategies/oidc.strategy';
import { SignupService } from './signup.service';
import { TokenService } from './token.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { User } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    private readonly oidcStrategy: OidcStrategy,
    private readonly signupService: SignupService,
    private readonly tokenService: TokenService,
    private readonly userRepo: UserRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  async getAuthorizationUrl(state: string): Promise<string> {
    const client = await this.oidcStrategy.getClient();
    const redirectUri = this.environmentService.getOidcRedirectUri();
    
    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      state: state,
    });

    this.logger.log(`Generated OIDC authorization URL`);
    return authUrl;
  }

  async handleCallback(
    code: string,
    state: string,
    workspaceId: string,
  ): Promise<{ user: User; authToken: string }> {
    try {
      const client = await this.oidcStrategy.getClient();
      const redirectUri = this.environmentService.getOidcRedirectUri();

      // Exchange code for tokens
      const tokenSet = await client.callback(redirectUri, { code, state }, { state });

      // Validate and get user info
      const profile = await this.oidcStrategy.validate(tokenSet);

      this.logger.log(`OIDC callback successful for email: ${profile.email}`);

      // Find or create user
      let user = await this.userRepo.findByEmail(profile.email, workspaceId);

      if (!user) {
        // Auto-create user if OIDC auto-provisioning is enabled
        if (!this.environmentService.isOidcAutoProvision()) {
          throw new UnauthorizedException(
            'User does not exist and auto-provisioning is disabled',
          );
        }

        this.logger.log(`Auto-provisioning new user: ${profile.email}`);

        // Extract name from profile
        const name = profile.name || 
                    (profile.given_name && profile.family_name 
                      ? `${profile.given_name} ${profile.family_name}` 
                      : profile.preferred_username) || 
                    profile.email.split('@')[0];

        user = await this.signupService.signup(
          {
            email: profile.email,
            name: name,
            password: undefined, // No password for OIDC users
          },
          workspaceId,
        );

        // Update user to mark email as verified for OIDC users
        await this.userRepo.updateUser(
          { emailVerifiedAt: new Date() },
          user.id,
          workspaceId,
        );
      } else if (user.deletedAt || user.deactivatedAt) {
        throw new UnauthorizedException('User account is not active');
      }

      // Update last login
      await this.userRepo.updateLastLogin(user.id, workspaceId);

      // Generate access token
      const authToken = await this.tokenService.generateAccessToken(user);

      return { user, authToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`OIDC callback error: ${message}`, stack);
      throw new UnauthorizedException(`OIDC authentication failed: ${message}`);
    }
  }

  isOidcEnabled(): boolean {
    const issuer = this.environmentService.getOidcIssuer();
    const clientId = this.environmentService.getOidcClientId();
    const clientSecret = this.environmentService.getOidcClientSecret();
    const redirectUri = this.environmentService.getOidcRedirectUri();

    return !!(issuer && clientId && clientSecret && redirectUri);
  }
}
