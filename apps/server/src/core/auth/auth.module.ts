import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SignupService } from './services/signup.service';
import { UserModule } from '../user/user.module';
import { SpaceModule } from '../space/space.module';
import { GroupModule } from '../group/group.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (environmentService: EnvironmentService) => {
        return {
          secret: environmentService.getJwtSecret(),
          signOptions: {
            expiresIn: environmentService.getJwtTokenExpiresIn(),
          },
        };
      },
      inject: [EnvironmentService],
    } as any),
    UserModule,
    WorkspaceModule,
    SpaceModule,
    GroupModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SignupService, TokenService, JwtStrategy],
  exports: [TokenService],
})
export class AuthModule {}
