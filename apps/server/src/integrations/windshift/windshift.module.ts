import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { IntegrationOAuthRegistry } from '../integration-oauth/manifest.registry';
import { WINDSHIFT_MANIFEST } from './windshift.manifest';

/**
 * Registers the Windshift provider manifest at boot. User-facing resource and
 * OAuth lists still hide it until a workspace admin configures a base
 * connection (or legacy WINDSHIFT_* env vars provide one).
 */
@Injectable()
class WindshiftRegistration implements OnModuleInit {
  private readonly logger = new Logger(WindshiftRegistration.name);

  constructor(private readonly registry: IntegrationOAuthRegistry) {}

  onModuleInit(): void {
    this.registry.register(WINDSHIFT_MANIFEST);
    this.logger.log('Registered windshift integration provider');
  }
}

@Module({
  providers: [WindshiftRegistration],
})
export class WindshiftModule {}
