import { Module } from '@nestjs/common';
import { PageVerificationService } from './page-verification.service';
import { PageVerificationController } from './page-verification.controller';
import { PageVerificationRepo } from './page-verification.repo';
import { PageVerificationSchedulerService } from './page-verification-scheduler.service';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';
import { QueueModule } from '../../integrations/queue/queue.module';

@Module({
  imports: [PageAccessModule, QueueModule],
  providers: [
    PageVerificationService,
    PageVerificationRepo,
    PageVerificationSchedulerService,
  ],
  controllers: [PageVerificationController],
  exports: [PageVerificationSchedulerService],
})
export class PageVerificationModule {}
