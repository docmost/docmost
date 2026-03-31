import { Module } from '@nestjs/common';
import { LicenseModule } from './license/license.module';
import { AttachmentEeModule } from './attachments-ee/attachment-ee.module';

@Module({
  imports: [LicenseModule, AttachmentEeModule],
  exports: [LicenseModule, AttachmentEeModule],
})
export class EeModule {}
