import { Module } from '@nestjs/common';
import { ChangeSetController } from './change-set.controller';
import { ReviewController } from './review.controller';
import { ChangeSetService } from './services/change-set.service';
import { ReviewService } from './services/review.service';
import { ComplianceSchemaService } from './compliance-schema.service';

@Module({
  controllers: [ChangeSetController, ReviewController],
  providers: [ChangeSetService, ReviewService, ComplianceSchemaService],
})
export class ComplianceModule {}
