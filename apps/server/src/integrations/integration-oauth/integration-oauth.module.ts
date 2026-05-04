import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentModule } from '../environment/environment.module';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthClientService } from './integration-oauth-client.service';
import { IntegrationOAuthController } from './integration-oauth.controller';

/**
 * Generic third-party-OAuth integration framework.
 *
 * Consumer modules (e.g. the windshift integration that follows in a sibling
 * PR) declare an `IntegrationManifest` and call `IntegrationOAuthRegistry
 * .register()` from their constructor or `onModuleInit`. The framework
 * supplies:
 *
 *   - `IntegrationOAuthService` — start/finish OAuth flows, refresh tokens,
 *     read decrypted tokens.
 *   - `IntegrationOAuthClientService` — per-user authenticated outbound HTTP
 *     client with refresh-on-401, refresh mutex, and a 30s LRU response cache.
 *   - `IntegrationOAuthTokenRepo` — Kysely repo over `integration_oauth_tokens`.
 *   - `IntegrationOAuthRegistry` — code-defined manifest registry.
 *
 * Marked @Global so consumer modules don't need to re-import this everywhere.
 */
@Global()
@Module({
  imports: [ConfigModule, EnvironmentModule],
  controllers: [IntegrationOAuthController],
  providers: [
    IntegrationOAuthRegistry,
    IntegrationOAuthTokenRepo,
    IntegrationOAuthService,
    IntegrationOAuthClientService,
  ],
  exports: [
    IntegrationOAuthRegistry,
    IntegrationOAuthService,
    IntegrationOAuthClientService,
  ],
})
export class IntegrationOAuthModule {}
