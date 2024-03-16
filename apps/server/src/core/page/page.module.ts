import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { PageRepository } from './repositories/page.repository';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PageOrderingService } from './services/page-ordering.service';
import { PageOrdering } from './entities/page-ordering.entity';
import { PageHistoryService } from './services/page-history.service';
import { PageHistory } from './entities/page-history.entity';
import { PageHistoryRepository } from './repositories/page-history.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Page, PageOrdering, PageHistory]),
    WorkspaceModule,
  ],
  controllers: [PageController],
  providers: [
    PageService,
    PageOrderingService,
    PageHistoryService,
    PageRepository,
    PageHistoryRepository,
  ],
  exports: [
    PageService,
    PageOrderingService,
    PageHistoryService,
    PageRepository,
  ],
})
export class PageModule {}
