import { Module } from '@nestjs/common';
import { PageVerificationInvalidationService } from './page-verification-invalidation.service';

@Module({
  providers: [PageVerificationInvalidationService],
  exports: [PageVerificationInvalidationService],
})
export class PageVerificationInvalidationModule {}
