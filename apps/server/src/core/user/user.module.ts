import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { AuthProviderRepo } from '../../database/repos/auth-provider/auth-provider.repo';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepo, AuthProviderRepo],
  exports: [UserService, UserRepo],
})
export class UserModule { }
