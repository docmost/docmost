import { Module } from '@nestjs/common';
import { GroupService } from './services/group.service.js';
import { GroupController } from './group.controller.js';
import { GroupUserService } from './services/group-user.service.js';

@Module({
  imports: [],
  controllers: [GroupController],
  providers: [GroupService, GroupUserService],
  exports: [GroupService, GroupUserService],
})
export class GroupModule {}
