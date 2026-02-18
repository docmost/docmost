import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { TrashCleanupService } from './services/trash-cleanup.service';
import { StorageModule } from '../../integrations/storage/storage.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { WatcherModule } from '../watcher/watcher.module';

@Module({
  controllers: [PageController],
  providers: [PageService, PageHistoryService, TrashCleanupService],
  exports: [PageService, PageHistoryService],
  imports: [StorageModule, CollaborationModule, WatcherModule],
})
export class PageModule {}
