import { Module } from '@nestjs/common';
import { IntegrationRegistry } from './registry/integration-registry.js';
import { IntegrationService } from './integration.service.js';
import { IntegrationConnectionService } from './integration-connection.service.js';
import { IntegrationController } from './integration.controller.js';
import { OAuthController } from './oauth/oauth.controller.js';
import { OAuthService } from './oauth/oauth.service.js';
import { UnfurlController } from './unfurl/unfurl.controller.js';
import { UnfurlService } from './unfurl/unfurl.service.js';
import { IntegrationRepo } from './repos/integration.repo.js';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo.js';
import { IntegrationListener } from './integration.listener.js';
import { IntegrationProcessor } from './integration.processor.js';
import { EnvironmentService } from '../../integrations/environment/environment.service.js';

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
