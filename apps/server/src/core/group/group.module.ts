import { Module } from '@nestjs/common';
import { GroupService } from './services/group.service';
import { GroupController } from './group.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { GroupUser } from './entities/group-user.entity';
import { GroupRepository } from './respositories/group.repository';
import { GroupUserRepository } from './respositories/group-user.repository';
import { GroupUserService } from './services/group-user.service';

@Module({
  imports: [TypeOrmModule.forFeature([Group, GroupUser])],
  controllers: [GroupController],
  providers: [
    GroupService,
    GroupUserService,
    GroupRepository,
    GroupUserRepository,
  ],
})
export class GroupModule {}
