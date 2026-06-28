import { Module } from '@nestjs/common';
import { DocxImportService } from './docx-import.service';
import { PdfImportService } from './pdf-import.service';

@Module({
  providers: [DocxImportService, PdfImportService],
  exports: [DocxImportService, PdfImportService],
})
export class DocumentImportModule {}
