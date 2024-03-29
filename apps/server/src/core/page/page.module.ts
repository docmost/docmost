import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PageOrderingService } from './services/page-ordering.service';
import { PageHistoryService } from './services/page-history.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [PageController],
  providers: [PageService, PageOrderingService, PageHistoryService],
  exports: [PageService, PageOrderingService, PageHistoryService],
})
export class PageModule {}
