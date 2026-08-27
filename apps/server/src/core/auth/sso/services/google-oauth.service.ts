import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { EnvironmentService } from '../../../../integrations/environment/environment.service';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  hostedDomain: string | null;
}

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  getCallbackUrl(): string {
    return `${this.environmentService.getAppUrl()}/api/sso/google/callback`;
  }

  private createClient(): OAuth2Client {
    if (!this.environmentService.isGoogleSsoEnabled()) {
      throw new BadRequestException('Google SSO is not configured.');
    }

    return new OAuth2Client({
      clientId: this.environmentService.getGoogleClientId(),
      clientSecret: this.environmentService.getGoogleClientSecret(),
      redirectUri: this.getCallbackUrl(),
    });
  }

  /**
   * Google's consent screen URL. `state` is a signed JWT, so the callback can
   * trust the workspace/redirect it carries without server-side storage.
   */
  buildAuthorizationUrl(state: string): string {
    return this.createClient().generateAuthUrl({
      access_type: 'online',
      scope: GOOGLE_SCOPES,
      state,
      prompt: 'select_account',
    });
  }

  async exchangeCode(code: string): Promise<GoogleIdentity> {
    const client = this.createClient();

    let idToken: string;
    try {
      const { tokens } = await client.getToken(code);
      idToken = tokens.id_token;
    } catch (err: any) {
      this.logger.warn(`Google code exchange failed: ${err?.message}`);
      throw new UnauthorizedException('Google sign-in failed.');
    }

    if (!idToken) {
      throw new UnauthorizedException('Google did not return an id token.');
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.environmentService.getGoogleClientId(),
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload?.email) {
      throw new UnauthorizedException('Google profile is incomplete.');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name ?? null,
      hostedDomain: payload.hd ?? null,
    };
  }
}
