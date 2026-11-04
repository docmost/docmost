import { Module } from '@nestjs/common';
import { IntegrationRegistry } from './registry/integration-registry';
import { IntegrationService } from './integration.service';
import { IntegrationConnectionService } from './integration-connection.service';
import { IntegrationController } from './integration.controller';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { UnfurlController } from './unfurl/unfurl.controller';
import { UnfurlService } from './unfurl/unfurl.service';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { IntegrationListener } from './integration.listener';
import { IntegrationProcessor } from './integration.processor';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Module({
  controllers: [IntegrationController, OAuthController, UnfurlController],
  providers: [
    {
      provide: IntegrationRegistry,
      useFactory: (environmentService: EnvironmentService) =>
        new IntegrationRegistry(environmentService.isCloud()),
      inject: [EnvironmentService],
    },
    IntegrationService,
    IntegrationConnectionService,
    OAuthService,
    UnfurlService,
    IntegrationRepo,
    IntegrationConnectionRepo,
    IntegrationListener,
    IntegrationProcessor,
  ],
  exports: [
    IntegrationRegistry,
    IntegrationService,
    IntegrationConnectionService,
    OAuthService,
    IntegrationRepo,
    IntegrationConnectionRepo,
  ],
})
export class IntegrationModule {}
