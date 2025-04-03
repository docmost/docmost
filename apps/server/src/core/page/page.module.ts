import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { PageMemberService } from './services/page-member.service';

@Module({
  controllers: [PageController],
  providers: [PageService, PageHistoryService, PageMemberService],
  exports: [PageService, PageHistoryService, PageMemberService],
})
export class PageModule {}
