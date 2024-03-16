import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PageModule } from '../page/page.module';

@Module({
  imports: [PageModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
