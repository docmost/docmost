import { Module } from '@nestjs/common';
import { ImportService } from './services/import.service';
import { ImportController } from './import.controller';
import { StorageModule } from '../storage/storage.module';
import { FileTaskService } from './services/file-task.service';
import { FileTaskProcessor } from './processors/file-task.processor';
import { ImportAttachmentService } from './services/import-attachment.service';

@Module({
  providers: [
    ImportService,
    FileTaskService,
    FileTaskProcessor,
    ImportAttachmentService,
  ],
  exports: [ImportService, ImportAttachmentService],
  controllers: [ImportController],
  imports: [StorageModule],
})
export class ImportModule {}
