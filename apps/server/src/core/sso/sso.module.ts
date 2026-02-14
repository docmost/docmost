import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { SsoService } from './services/sso.service';
import { TokenModule } from '../auth/token.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TokenModule, AuthModule],
  controllers: [SsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}
