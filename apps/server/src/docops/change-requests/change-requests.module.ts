import { Module } from '@nestjs/common';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { DocopsAuditModule } from '../audit/audit.module';
import { DocopsWebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [DocopsAuditModule, DocopsWebhooksModule],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
  exports: [ChangeRequestsService],
})
export class DocopsChangeRequestsModule {}
