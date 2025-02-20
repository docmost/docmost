import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { SpaceModule } from '../space/space.module';
import { PageModule } from '../page/page.module';
import { SearchModule } from '../search/search.module';
import { ExportModule } from 'src/integrations/export/export.module';

@Module({
  controllers: [ShareController],
  imports: [SpaceModule, PageModule, SearchModule, ExportModule]
})
export class ShareModule {}
