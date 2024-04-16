import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PageHistoryService } from './services/page-history.service';

@Module({
  imports: [WorkspaceModule],
  controllers: [PageController],
  providers: [PageService, PageHistoryService],
  exports: [PageService, PageHistoryService],
})
export class PageModule {}
