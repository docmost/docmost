import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE, NoopAuditService } from './audit.service';

@Global()
@Module({
  providers: [
    {
      provide: AUDIT_SERVICE,
      useClass: NoopAuditService,
    },
  ],
  exports: [AUDIT_SERVICE],
})
export class NoopAuditModule {}
