import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PublicSpaceModule } from '../public-space/public-space.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [PublicSpaceModule, ShareModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
