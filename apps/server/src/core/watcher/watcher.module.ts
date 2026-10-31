import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service.js';
import { WatcherController } from './watcher.controller.js';
import { SpaceWatcherController } from './space-watcher.controller.js';
import { PageAccessModule } from '../page/page-access/page-access.module.js';

@Module({
  imports: [PageAccessModule],
  controllers: [WatcherController, SpaceWatcherController],
  providers: [WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
