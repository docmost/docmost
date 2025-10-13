import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SignupService } from './services/signup.service';
import { TokenModule } from './token.module';
import { OidcController } from './oidc.controller';
import { OidcService } from './services/oidc.service';

@Module({
  imports: [TokenModule, WorkspaceModule],
  controllers: [AuthController, OidcController],
  providers: [AuthService, SignupService, JwtStrategy, OidcStrategy, OidcService],
  exports: [SignupService, OidcService],
})
export class AuthModule {}
