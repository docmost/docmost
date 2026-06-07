import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { TokenModule } from '../../core/auth/token.module';
import { ApiKeyModule } from '../../core/api-key/api-key.module';
import { SearchModule } from '../../core/search/search.module';
import { PageModule } from '../../core/page/page.module';
import { SpaceModule } from '../../core/space/space.module';
import { PageAccessModule } from '../../core/page/page-access/page-access.module';
import { LabelModule } from '../../core/label/label.module';
import { OrganizeModule } from '../../core/organize/organize.module';
import { DedupModule } from '../../core/dedup/dedup.module';

@Module({
  imports: [
    TokenModule,
    ApiKeyModule,
    SearchModule,
    PageModule,
    SpaceModule,
    PageAccessModule,
    LabelModule,
    OrganizeModule,
    DedupModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
