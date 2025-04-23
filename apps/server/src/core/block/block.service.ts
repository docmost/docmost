import { Injectable } from '@nestjs/common';
// import { BlockDto } from './dto/block.dto';
import { BlockRepo } from '@docmost/db/repos/block/block.repo';

@Injectable()
export class BlockService {
  constructor(private blockRepo: BlockRepo) {}

  async echoBlock() {
    await Promise.resolve();
  }
}
