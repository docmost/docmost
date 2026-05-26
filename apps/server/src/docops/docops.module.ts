import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DocopsServicesModule } from './services/services.module';
import { DocopsChangeRequestsModule } from './change-requests/change-requests.module';
import { DocopsAuditModule } from './audit/audit.module';
import { DocopsDashboardModule } from './dashboard/dashboard.module';
import { DocopsWebhooksModule } from './webhooks/webhooks.module';
import { DocOpsMutationInterceptor } from './common/interceptors/docops-mutation.interceptor';

@Module({
  imports: [
    DocopsServicesModule,
    DocopsChangeRequestsModule,
    DocopsAuditModule,
    DocopsDashboardModule,
    DocopsWebhooksModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: DocOpsMutationInterceptor,
    },
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
