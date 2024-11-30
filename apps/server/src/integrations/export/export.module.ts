import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ImportController } from './export.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [ExportService],
  controllers: [ImportController],
})
export class ExportModule {}
