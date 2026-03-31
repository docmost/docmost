import { Module } from '@nestjs/common';
import { AttachmentEeService } from './attachment-ee.service';
import { AttachmentSearchController } from './attachment-search.controller';
import { StorageModule } from '../../integrations/storage/storage.module';
import { SearchModule } from '../../core/search/search.module';
import { CaslModule } from '../../core/casl/casl.module';

@Module({
  imports: [StorageModule, SearchModule, CaslModule],
  controllers: [AttachmentSearchController],
  providers: [AttachmentEeService],
  exports: [AttachmentEeService],
})
export class AttachmentEeModule {}
