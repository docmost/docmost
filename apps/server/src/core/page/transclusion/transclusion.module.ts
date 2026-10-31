import { Module } from '@nestjs/common';
import { TransclusionController } from './transclusion.controller.js';
import { TransclusionService } from './transclusion.service.js';

@Module({
  controllers: [TransclusionController],
  providers: [TransclusionService],
  exports: [TransclusionService],
})
export class TransclusionModule {}
