import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SignupService } from './services/signup.service';
import { TokenModule } from './token.module';
import { LdapAuthService } from './services/ldap-auth.service';
import { LdapProvisioningService } from './services/ldap-provisioning.service';

@Module({
  imports: [TokenModule, WorkspaceModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SignupService,
    JwtStrategy,
    LdapAuthService,
    LdapProvisioningService,
  ],
  exports: [SignupService],
})
export class AuthModule {}
