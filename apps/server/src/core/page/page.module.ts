import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { PageMemberService } from './services/page-member.service';
import { SynchronizedPageService } from './services/synchronized-page.service';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';

@Module({
  controllers: [PageController],
  providers: [
    PageService,
    PageHistoryService,
    PageMemberService,
    SynchronizedPageService,
  ],
  exports: [
    PageService,
    PageHistoryService,
    PageMemberService,
    SynchronizedPageService,
  ],
})
export class PageModule {}
