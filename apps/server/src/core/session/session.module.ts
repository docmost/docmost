import { Global, Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionActivityService } from './session-activity.service';
import { SessionController } from './session.controller';
import { TokenModule } from '../auth/token.module';

@Global()
@Module({
  imports: [TokenModule],
  controllers: [SessionController],
  providers: [SessionService, SessionActivityService],
  exports: [SessionService, SessionActivityService],
})
export class SessionModule {}
