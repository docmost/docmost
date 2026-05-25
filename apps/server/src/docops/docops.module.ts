import { Module } from '@nestjs/common';
import { DocopsServicesModule } from './services/services.module';
import { DocopsChangeRequestsModule } from './change-requests/change-requests.module';
import { DocopsAuditModule } from './audit/audit.module';
import { DocopsDashboardModule } from './dashboard/dashboard.module';
import { DocopsWebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    DocopsServicesModule,
    DocopsChangeRequestsModule,
    DocopsAuditModule,
    DocopsDashboardModule,
    DocopsWebhooksModule,
  ],
  exports: [
    DocopsServicesModule,
    DocopsChangeRequestsModule,
    DocopsAuditModule,
    DocopsDashboardModule,
    DocopsWebhooksModule,
  ],
})
export class DocopsModule {}
