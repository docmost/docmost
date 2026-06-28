import { Module } from '@nestjs/common';
import { AttachmentEeService } from './attachment-ee.service';
import { StorageModule } from '../../integrations/storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [AttachmentEeService],
  exports: [AttachmentEeService],
})
export class AttachmentEeModule {}
