import { Module } from '@nestjs/common';
import { PageService } from './services/page.service.js';
import { PageController } from './page.controller.js';
import { PageHistoryService } from './services/page-history.service.js';
import { TrashCleanupService } from './services/trash-cleanup.service.js';
import { BacklinkService } from './services/backlink.service.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { CollaborationModule } from '../../collaboration/collaboration.module.js';
import { WatcherModule } from '../watcher/watcher.module.js';
import { TransclusionModule } from './transclusion/transclusion.module.js';
import { LabelModule } from '../label/label.module.js';

@Module({
  controllers: [PageController],
  providers: [
    PageService,
    PageHistoryService,
    TrashCleanupService,
    BacklinkService,
  ],
  exports: [PageService, PageHistoryService],
  imports: [
    StorageModule,
    CollaborationModule,
    WatcherModule,
    TransclusionModule,
    LabelModule,
  ],
})
export class PageModule {}
