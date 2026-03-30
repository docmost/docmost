import { Module } from '@nestjs/common';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';
import { OidcProviderService } from './providers/oidc-provider.service';

@Module({
  controllers: [OidcController],
  providers: [OidcService, OidcProviderService],
})
export class OidcModule {}
