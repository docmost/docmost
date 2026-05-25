import { Module } from '@nestjs/common';
import { DocopsServicesModule } from './services/services.module';
import { DocopsChangeRequestsModule } from './change-requests/change-requests.module';
import { DocopsAuditModule } from './audit/audit.module';
import { DocopsDashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    DocopsServicesModule,
    DocopsChangeRequestsModule,
    DocopsAuditModule,
    DocopsDashboardModule,
  ],
  exports: [
    DocopsServicesModule,
    DocopsChangeRequestsModule,
    DocopsAuditModule,
    DocopsDashboardModule,
  ],
})
export class DocopsModule {}
