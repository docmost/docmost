import { Global, Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { WsService } from './ws.service';
import { WsTreeService } from './ws-tree.service';
import { TokenModule } from '../core/auth/token.module';

@Global()
@Module({
  imports: [TokenModule],
  providers: [WsGateway, WsService, WsTreeService],
  exports: [WsGateway, WsService, WsTreeService],
})
export class WsModule {}
