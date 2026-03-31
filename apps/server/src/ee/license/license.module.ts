import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

@Module({
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
