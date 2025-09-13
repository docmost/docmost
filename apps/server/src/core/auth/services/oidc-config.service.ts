import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OidcConfigService {
  constructor(private configService: ConfigService) {}

  getOidcButtonText(): string {
    return this.configService.get<string>('OIDC_BUTTON_TEXT', 'Sign in with SSO');
  }

  getOidcAutoRedirect(): boolean {
    return this.configService.get<string>('OIDC_AUTO_REDIRECT', 'false') === 'true';
  }
}
