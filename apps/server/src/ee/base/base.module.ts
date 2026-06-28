import { Module } from '@nestjs/common';
import { BaseService } from './base.service';
import { BaseController } from './base.controller';
import { BaseRepo } from './base.repo';
import { PageModule } from '../../core/page/page.module';
import { BaseWsService } from './realtime/base-ws.service';

@Module({
  imports: [PageModule],
  providers: [BaseService, BaseRepo, BaseWsService],
  controllers: [BaseController],
  exports: [BaseWsService],
})
export class BaseModule {}
