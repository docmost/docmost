import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
