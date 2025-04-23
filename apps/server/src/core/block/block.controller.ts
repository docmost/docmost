import {
  Controller,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';

import { BlockService } from './block.service';

@Controller('blocks')
export class BlockController {
  constructor(
    private blockService: BlockService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Get('block')
  async block() {
    await this.blockService.echoBlock()
    return 'TODO block'
  }
}
