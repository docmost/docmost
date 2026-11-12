import { Global, Module } from '@nestjs/common';
import { LEGAL_HOLD_SERVICE, NoopLegalHoldService } from './legal-hold.service';

@Global()
@Module({
  providers: [
    {
      provide: LEGAL_HOLD_SERVICE,
      useClass: NoopLegalHoldService,
    },
  ],
  exports: [LEGAL_HOLD_SERVICE],
})
export class NoopLegalHoldModule {}
