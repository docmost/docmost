import { Module } from '@nestjs/common';
import { GroupService } from './services/group.service';
import { GroupController } from './group.controller';
import { GroupUserService } from './services/group-user.service';
import { WatcherModule } from '../watcher/watcher.module';

@Module({
  imports: [WatcherModule],
  controllers: [GroupController],
  providers: [GroupService, GroupUserService],
  exports: [GroupService, GroupUserService],
})
export class GroupModule {}
