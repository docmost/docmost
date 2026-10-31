import { Global, Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway.js';
import { WsService } from './ws.service.js';
import { WsTreeService } from './ws-tree.service.js';
import { TokenModule } from '../core/auth/token.module.js';
import { BaseRealtimeBridge } from './base-realtime.bridge.js';

@Global()
@Module({
  imports: [TokenModule],
  providers: [WsGateway, WsService, WsTreeService, BaseRealtimeBridge],
  exports: [WsGateway, WsService, WsTreeService],
})
export class WsModule {}
