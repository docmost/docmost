import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { EnvironmentService } from '../../environment/environment.service';
import { TokenService } from './services/token.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (environmentService: EnvironmentService) => {
        return {
          global: true,
          secret: environmentService.getJwtSecret(),
          signOptions: {
            expiresIn: environmentService.getJwtTokenExpiresIn(),
          },
        };
      },
      inject: [EnvironmentService],
    }),
    forwardRef(() => UserModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
