import { Global, Module } from '@nestjs/common';
import { PageApprovalService } from './page-approval.service';

@Global()
@Module({
  providers: [PageApprovalService],
  exports: [PageApprovalService],
})
export class PageApprovalModule {}
