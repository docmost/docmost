import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { TokenModule } from '../core/auth/token.module';
import { ExcalidrawCollabService } from './services/excalidraw-collab.service';

@Module({
  imports: [TokenModule],
  providers: [WsGateway, ExcalidrawCollabService],
})
export class WsModule {}
