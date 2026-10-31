import { Module } from '@nestjs/common';
import { LabelController } from './label.controller.js';
import { LabelService } from './label.service.js';

@Module({
  controllers: [LabelController],
  providers: [LabelService],
  exports: [LabelService],
})
export class LabelModule {}
