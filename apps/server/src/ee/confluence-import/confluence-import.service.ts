import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { FileImportTaskService } from '../../integrations/import/services/file-import-task.service';
import { FileTask } from '@docmost/db/types/entity.types';

@Injectable()
export class ConfluenceImportService {
  private readonly logger = new Logger(ConfluenceImportService.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async processConfluenceImport(opts: {
    extractDir: string;
    fileTask: FileTask;
  }): Promise<void> {
    const fileImportTaskService = this.moduleRef.get(FileImportTaskService, {
      strict: false,
    });
    if (!fileImportTaskService?.processGenericImport) {
      this.logger.error('FileImportTaskService unavailable for Confluence import');
      return;
    }
    await fileImportTaskService.processGenericImport(opts);
  }
}
