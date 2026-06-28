import { Module } from '@nestjs/common';
import { PdfExportService } from './pdf-export.service';
import { PdfExportController } from './pdf-export.controller';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';
import { TokenModule } from '../../core/auth/token.module';
import { StorageModule } from '../../integrations/storage/storage.module';

@Module({
  imports: [PageAccessModule, TokenModule, StorageModule],
  providers: [PdfExportService],
  controllers: [PdfExportController],
  exports: [PdfExportService],
})
export class PdfExportModule {}
