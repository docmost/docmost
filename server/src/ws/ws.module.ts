import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';

@Module({
  providers: [WsGateway],
})
export class WsModule {}
