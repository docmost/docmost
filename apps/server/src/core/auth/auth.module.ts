import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';
import { SignupService } from './services/signup.service.js';
import { TokenModule } from './token.module.js';

@Module({
  imports: [TokenModule, WorkspaceModule],
  controllers: [AuthController],
  providers: [AuthService, SignupService, JwtStrategy],
  exports: [SignupService],
})
export class AuthModule {}
