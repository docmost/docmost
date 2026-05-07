import { Module } from '@nestjs/common';
import { TransclusionController } from './transclusion.controller';
import { TransclusionService } from './transclusion.service';
import { StorageModule } from '../../../integrations/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [TransclusionController],
  providers: [TransclusionService],
  exports: [TransclusionService],
})
export class TransclusionModule {}
