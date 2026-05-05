import { Injectable, Logger } from '@nestjs/common';
import { IntegrationManifest } from './manifest.types';

/**
 * In-memory registry of integration manifests. Consumer modules call
 * `register()` at boot. Manifests are code-defined and shipped with the
 * deployment — DB persistence would let an admin redirect tokens to a
 * different provider at runtime.
 */
@Injectable()
export class IntegrationOAuthRegistry {
  private readonly logger = new Logger(IntegrationOAuthRegistry.name);
  private readonly manifests = new Map<string, IntegrationManifest>();

  register(manifest: IntegrationManifest): void {
    if (this.manifests.has(manifest.id)) {
      throw new Error(
        `Integration manifest with id="${manifest.id}" is already registered`,
      );
    }
    this.manifests.set(manifest.id, manifest);
    this.logger.log(`Registered integration manifest: ${manifest.id}`);
  }

  get(id: string): IntegrationManifest | undefined {
    return this.manifests.get(id);
  }

  /** Throws when the integration is unknown — for routes that need to fail loudly. */
  require(id: string): IntegrationManifest {
    const m = this.manifests.get(id);
    if (!m) {
      throw new Error(`Unknown integration: ${id}`);
    }
    return m;
  }

  list(): IntegrationManifest[] {
    return [...this.manifests.values()];
  }
}
