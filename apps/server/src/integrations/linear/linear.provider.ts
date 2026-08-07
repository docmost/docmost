import { Injectable, OnModuleInit } from '@nestjs/common';
import { Oauth2ProviderRegistry } from '../oauth2/oauth2-provider.registry';
import { OAuth2Identity, OAuth2Provider } from '../oauth2/oauth2.types';
import { LinearApiService } from './linear-api.service';

export const LINEAR_PROVIDER = 'linear';

// Linear's OAuth2 provider description; self-registers with the registry at startup.
@Injectable()
export class LinearOAuth2Provider implements OAuth2Provider, OnModuleInit {
  readonly key = LINEAR_PROVIDER;
  readonly displayName = 'Linear';
  readonly authorizeUrl = 'https://linear.app/oauth/authorize';
  readonly tokenUrl = 'https://api.linear.app/oauth/token';
  readonly revokeUrl = 'https://api.linear.app/oauth/revoke';
  // read for previews/search, write + issues:create for issue creation
  readonly scopes = 'read,write,issues:create';
  readonly authorizeExtraParams = { actor: 'user', prompt: 'consent' };

  constructor(
    private readonly registry: Oauth2ProviderRegistry,
    private readonly linearApiService: LinearApiService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async fetchIdentity(accessToken: string): Promise<OAuth2Identity> {
    const viewer = await this.linearApiService.getViewer(accessToken);
    return { id: viewer.id, name: viewer.name };
  }
}
