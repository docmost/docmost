import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { TrashCleanupService } from './services/trash-cleanup.service';
import { PagePermissionService } from './services/page-permission.service';
import { PageHierarchyService } from './services/page-hierarchy.service';
import { PagePermissionController } from './page-permission.controller';
import { StorageModule } from '../../integrations/storage/storage.module';

@Module({
  controllers: [PageController, PagePermissionController],
  providers: [
    PageService,
    PageHistoryService,
    TrashCleanupService,
    PagePermissionService,
    PageHierarchyService,
  ],
  exports: [
    PageService,
    PageHistoryService,
    PagePermissionService,
    PageHierarchyService,
  ],
  imports: [StorageModule],
})
export class PageModule {}
