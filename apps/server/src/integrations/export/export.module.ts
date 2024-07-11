import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ImportController } from './export.controller';

@Module({
  providers: [ExportService],
  controllers: [ImportController],
})
export class ExportModule {}
