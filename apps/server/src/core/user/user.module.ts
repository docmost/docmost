import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SpaceModule } from '../space/space.module';

@Module({
  imports: [SpaceModule],
  controllers: [UserController],
  providers: [UserService, UserRepo],
  exports: [UserService, UserRepo],
})
export class UserModule {}
