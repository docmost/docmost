import { Module } from '@nestjs/common';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { BlockRepo } from '@docmost/db/repos/block/block.repo';

@Module({
  controllers: [BlockController],
  providers: [BlockService, BlockRepo],
  exports: [BlockService, BlockRepo],
})
export class BlockModule {}