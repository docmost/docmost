import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PageModule } from '../page/page.module';

@Module({
  imports: [AuthModule, WorkspaceModule, PageModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
