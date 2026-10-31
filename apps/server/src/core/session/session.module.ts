import { Global, Module } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { SessionActivityService } from './session-activity.service.js';
import { SessionController } from './session.controller.js';
import { TokenModule } from '../auth/token.module.js';

@Global()
@Module({
  imports: [TokenModule],
  controllers: [SessionController],
  providers: [SessionService, SessionActivityService],
  exports: [SessionService, SessionActivityService],
})
export class SessionModule {}
