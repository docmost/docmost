import { Module } from '@nestjs/common';
import { SsoAuthService } from './sso-auth.service';
import { SsoAuthController } from './sso-auth.controller';
import { SsoModule } from '../sso/sso.module';
import { SessionModule } from '../../core/session/session.module';

@Module({
  imports: [SsoModule, SessionModule],
  providers: [SsoAuthService],
  controllers: [SsoAuthController],
})
export class SsoAuthModule {}
