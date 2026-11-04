import { Global, Module } from '@nestjs/common';
import { PAGE_ANALYTICS_SERVICE, NoopPageAnalyticsService } from './page-analytics.service';

@Global()
@Module({
  providers: [
    {
      provide: PAGE_ANALYTICS_SERVICE,
      useClass: NoopPageAnalyticsService,
    },
  ],
  exports: [PAGE_ANALYTICS_SERVICE],
})
export class NoopPageAnalyticsModule {}
