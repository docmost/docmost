import { Module } from '@nestjs/common';
import { ScimTokenService } from './scim-token.service';
import { ScimTokenController } from './scim-token.controller';
import { ScimTokenRepo } from './scim-token.repo';
import { ScimProvisioningService } from './scim-provisioning.service';
import { ScimProvisioningController } from './scim-provisioning.controller';
import { ScimAuthGuard } from './scim-auth.guard';

@Module({
  providers: [
    ScimTokenService,
    ScimTokenRepo,
    ScimProvisioningService,
    ScimAuthGuard,
  ],
  controllers: [ScimTokenController, ScimProvisioningController],
  exports: [ScimTokenService],
})
export class ScimModule {}
