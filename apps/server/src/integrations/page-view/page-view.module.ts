import { Global, Module } from '@nestjs/common';
import { PAGE_VIEW_SERVICE, NoopPageViewService } from './page-view.service';

@Global()
@Module({
  providers: [
    {
      provide: PAGE_VIEW_SERVICE,
      useClass: NoopPageViewService,
    },
  ],
  exports: [PAGE_VIEW_SERVICE],
})
export class NoopPageViewModule {}
