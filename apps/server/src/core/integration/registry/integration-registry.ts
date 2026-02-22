import { Injectable } from '@nestjs/common';
import {
  IntegrationDefinition,
  IntegrationProvider,
} from './integration-provider.interface';

@Injectable()
export class IntegrationRegistry {
  private providers = new Map<string, IntegrationProvider>();

  register(provider: IntegrationProvider): void {
    this.providers.set(provider.definition.type, provider);
  }

  getProvider(type: string): IntegrationProvider | undefined {
    return this.providers.get(type);
  }

  getAllProviders(): IntegrationProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableIntegrations(): IntegrationDefinition[] {
    return this.getAllProviders().map((p) => p.definition);
  }

  findUnfurlProvider(
    url: string,
  ): {
    provider: IntegrationProvider;
    match: RegExpMatchArray;
    patternType: string;
  } | null {
    for (const provider of this.providers.values()) {
      if (!provider.definition.unfurlPatterns) continue;
      for (const pattern of provider.definition.unfurlPatterns) {
        const match = url.match(pattern.regex);
        if (match) {
          return { provider, match, patternType: pattern.type };
        }
      }
    }
    return null;
  }
}
