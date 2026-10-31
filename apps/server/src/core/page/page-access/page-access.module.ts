import { Global, Module } from '@nestjs/common';
import { PageAccessService } from './page-access.service.js';

@Global()
@Module({
  providers: [PageAccessService],
  exports: [PageAccessService],
})
export class PageAccessModule {}
