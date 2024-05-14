import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { TokenModule } from '../core/auth/token.module';

@Module({
  imports: [TokenModule],
  providers: [WsGateway],
})
export class WsModule {}
