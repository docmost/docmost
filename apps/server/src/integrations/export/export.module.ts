import { Module } from '@nestjs/common';
import { ExportService } from './export.service.js';
import { ExportController } from './export.controller.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  providers: [ExportService],
  controllers: [ExportController],
})
export class ExportModule {}
