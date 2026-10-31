import { Module } from '@nestjs/common';
import { ImportService } from './services/import.service.js';
import { ImportController } from './import.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { FileImportTaskService } from './services/file-import-task.service.js';
import { FileTaskProcessor } from './processors/file-task.processor.js';
import { ImportAttachmentService } from './services/import-attachment.service.js';
import { FileTaskController } from './file-task.controller.js';
import { PageModule } from '../../core/page/page.module.js';

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
