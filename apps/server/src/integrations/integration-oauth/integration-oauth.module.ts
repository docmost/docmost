import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentModule } from '../environment/environment.module';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import { IntegrationOAuthConnectionRepo } from './integration-oauth-connection.repo';
import { IntegrationOAuthConnectionService } from './integration-oauth-connection.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthClientService } from './integration-oauth-client.service';
import { IntegrationOAuthController } from './integration-oauth.controller';
import { IntegrationOAuthAdminController } from './integration-oauth-admin.controller';
import { IntegrationResourceController } from './integration-resource.controller';

/**
 * Generic third-party-OAuth framework. Consumer modules declare an
 * IntegrationManifest and call IntegrationOAuthRegistry.register() at boot.
 * @Global so consumers don't have to re-import this everywhere.
 */
@Global()
@Module({
  imports: [ConfigModule, EnvironmentModule],
  controllers: [
    IntegrationOAuthAdminController,
    IntegrationOAuthController,
    IntegrationResourceController,
  ],
  providers: [
    IntegrationOAuthRegistry,
    IntegrationOAuthTokenRepo,
    IntegrationOAuthConnectionRepo,
    IntegrationOAuthConnectionService,
    IntegrationOAuthService,
    IntegrationOAuthClientService,
  ],
  exports: [
    IntegrationOAuthRegistry,
    IntegrationOAuthConnectionService,
    IntegrationOAuthService,
    IntegrationOAuthClientService,
  ],
})
export class IntegrationOAuthModule {}
