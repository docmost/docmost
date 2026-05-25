import { Module } from '@nestjs/common';
import { DocopsServicesModule } from './services/services.module';
import { DocopsChangeRequestsModule } from './change-requests/change-requests.module';
import { DocopsAuditModule } from './audit/audit.module';

@Module({
  imports: [DocopsServicesModule, DocopsChangeRequestsModule, DocopsAuditModule],
  exports: [DocopsServicesModule, DocopsChangeRequestsModule, DocopsAuditModule],
})
export class DocopsModule {}
