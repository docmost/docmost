import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { TrashCleanupService } from './services/trash-cleanup.service';
import { PagePermissionService } from './services/page-member.service';
import { SharedPagesRepo } from '@docmost/db/repos/page/shared-pages.repo';
import { StorageModule } from '../../integrations/storage/storage.module';

@Module({
  controllers: [PageController],
  providers: [
    PageService,
    PageHistoryService,
    TrashCleanupService,
    PagePermissionService,
    SharedPagesRepo,
  ],
  exports: [PageService, PageHistoryService, PagePermissionService],
  imports: [StorageModule],
})
export class PageModule {}
