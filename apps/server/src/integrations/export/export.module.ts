import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { StorageModule } from '../storage/storage.module';
import { PageModule } from 'src/core/page/page.module';

@Module({
  imports: [StorageModule, PageModule],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
