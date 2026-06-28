import { Module } from '@nestjs/common';
import { ConfluenceImportService } from './confluence-import.service';

@Module({
  providers: [ConfluenceImportService],
  exports: [ConfluenceImportService],
})
export class ConfluenceImportModule {}
