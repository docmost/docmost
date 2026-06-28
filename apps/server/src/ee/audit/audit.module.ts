import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE } from '../../integrations/audit/audit.service';
import { AuditLogService } from './audit-log.service';
import { AuditQueryService } from './audit-query.service';
import { AuditQueryController } from './audit-query.controller';

@Global()
@Module({
  providers: [
    AuditLogService,
    AuditQueryService,
    {
      provide: AUDIT_SERVICE,
      useExisting: AuditLogService,
    },
  ],
  controllers: [AuditQueryController],
  exports: [AUDIT_SERVICE, AuditQueryService],
})
export class AuditEeModule {}
