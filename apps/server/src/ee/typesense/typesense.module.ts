import { Module } from '@nestjs/common';
import { PageSearchService } from './services/page-search.service';
import { SearchModule } from '../../core/search/search.module';

@Module({
  imports: [SearchModule],
  providers: [PageSearchService],
  exports: [PageSearchService],
})
export class TypesenseEeModule {}
