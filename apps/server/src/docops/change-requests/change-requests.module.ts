import { Module } from '@nestjs/common';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { DocopsAuditModule } from '../audit/audit.module';

@Module({
  imports: [DocopsAuditModule],
  controllers: [ChangeRequestsController],
  providers: [ChangeRequestsService],
  exports: [ChangeRequestsService],
})
export class DocopsChangeRequestsModule {}
