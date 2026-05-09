import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { WatcherController } from './watcher.controller';
import { SpaceWatcherController } from './space-watcher.controller';
import { PageAccessModule } from '../page/page-access/page-access.module';

@Module({
  imports: [PageAccessModule],
  controllers: [WatcherController, SpaceWatcherController],
  providers: [WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
