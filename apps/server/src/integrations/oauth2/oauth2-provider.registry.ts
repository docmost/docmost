import { Injectable } from '@nestjs/common';
import { OAuth2Provider } from './oauth2.types';

// Registry of OAuth2 providers (each self-registers at startup); the service
// and controller resolve providers by key at request time.
@Injectable()
export class Oauth2ProviderRegistry {
  private readonly providers = new Map<string, OAuth2Provider>();

  register(provider: OAuth2Provider): void {
    this.providers.set(provider.key, provider);
  }

  get(key: string): OAuth2Provider | undefined {
    return this.providers.get(key);
  }

  has(key: string): boolean {
    return this.providers.has(key);
  }

  list(): OAuth2Provider[] {
    return Array.from(this.providers.values());
  }
}
