import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServicesRepository } from './services.repository';
import { DocopsAuditModule } from '../audit/audit.module';

@Module({
  imports: [DocopsAuditModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServicesRepository],
  exports: [ServicesService, ServicesRepository],
})
export class DocopsServicesModule {}
