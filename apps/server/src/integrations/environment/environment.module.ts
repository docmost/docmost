import { Global, Module } from '@nestjs/common';
import { EnvironmentService } from './environment.service.js';
import { ConfigModule } from '@nestjs/config';
import { validate } from './environment.validation.js';
import { envPath } from '../../common/helpers/index.js';
import { DomainService } from './domain.service.js';
import { LicenseCheckService } from './license-check.service.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: envPath,
      validate,
    }),
  ],
  providers: [EnvironmentService, DomainService, LicenseCheckService],
  exports: [EnvironmentService, DomainService, LicenseCheckService],
})
export class EnvironmentModule {}
