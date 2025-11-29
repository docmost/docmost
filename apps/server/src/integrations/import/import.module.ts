import { Module } from '@nestjs/common';
import { ImportService } from './services/import.service';
import { ImportController } from './import.controller';
import { StorageModule } from '../storage/storage.module';
import { FileImportTaskService } from './services/file-import-task.service';
import { FileTaskProcessor } from './processors/file-task.processor';
import { ImportAttachmentService } from './services/import-attachment.service';
import { FileTaskController } from './file-task.controller';
import { PageModule } from '../../core/page/page.module';

@Module({
  providers: [
    ImportService,
    FileImportTaskService,
    FileTaskProcessor,
    ImportAttachmentService,
  ],
  exports: [ImportService, ImportAttachmentService],
  controllers: [ImportController, FileTaskController],
  imports: [StorageModule, PageModule],
})
export class ImportModule {}
