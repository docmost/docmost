import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { SpaceController } from './space.controller';
import { SpaceMemberService } from './services/space-member.service';
import { WatcherModule } from '../watcher/watcher.module';

@Module({
  imports: [WatcherModule],
  controllers: [SpaceController],
  providers: [SpaceService, SpaceMemberService],
  exports: [SpaceService, SpaceMemberService],
})
export class SpaceModule {}
