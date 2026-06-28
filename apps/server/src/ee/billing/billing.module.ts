import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingRepo } from './billing.repo';

@Module({
  providers: [BillingService, BillingRepo],
  controllers: [BillingController],
})
export class BillingModule {}
