import { Module } from '@nestjs/common';
import { ImportModule } from './import.module';
import { FileTaskProcessor } from './processors/file-task.processor';

@Module({
  imports: [ImportModule],
  providers: [FileTaskProcessor],
})
export class ImportProcessorModule {}
