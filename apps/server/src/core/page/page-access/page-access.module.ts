import { Global, Module } from '@nestjs/common';
import { PageAccessService } from './page-access.service';

@Global()
@Module({
  providers: [PageAccessService],
  exports: [PageAccessService],
})
export class PageAccessModule {}
