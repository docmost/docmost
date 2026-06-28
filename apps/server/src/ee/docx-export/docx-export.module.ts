import { Module } from '@nestjs/common';
import { DocxExportService } from './docx-export.service';
import { DocxExportController } from './docx-export.controller';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';

@Module({
  imports: [PageAccessModule],
  providers: [DocxExportService],
  controllers: [DocxExportController],
})
export class DocxExportModule {}
