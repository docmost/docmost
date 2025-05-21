import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { StorageModule } from '../storage/storage.module';
import { FileTaskService } from './file-task.service';
import { FileTaskProcessor } from './processors/file-task.processor';

@Module({
  providers: [ImportService, FileTaskService, FileTaskProcessor],
  controllers: [ImportController],
  imports: [StorageModule],
})
export class ImportModule {}
