import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { UserProfileService } from './user-profile.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserProfileService, UserRepo],
  exports: [UserService, UserRepo],
})
export class UserModule {}
