import { Module } from '@nestjs/common';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { AuthProviderRepo } from './auth-provider.repo';

@Module({
  providers: [SsoService, AuthProviderRepo],
  controllers: [SsoController],
  exports: [SsoService, AuthProviderRepo],
})
export class SsoModule {}
