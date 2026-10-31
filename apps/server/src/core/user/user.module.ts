import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { UserRepo } from '@docmost/db/repos/user/user.repo.js';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepo],
  exports: [UserService, UserRepo],
})
export class UserModule {}
