import { Module } from '@nestjs/common';
import { TransclusionController } from './transclusion.controller';
import { TransclusionService } from './transclusion.service';

@Module({
  controllers: [TransclusionController],
  providers: [TransclusionService],
  exports: [TransclusionService],
})
export class TransclusionModule {}
