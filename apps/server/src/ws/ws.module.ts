import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { AuthModule } from '../core/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WsGateway],
})
export class WsModule {}
