import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './services/mcp-server.factory';
import { McpToolsService } from './services/mcp-tools.service';
import { PageModule } from '../../core/page/page.module';
import { SpaceModule } from '../../core/space/space.module';
import { SearchService } from '../../core/search/search.service';

@Module({
  imports: [PageModule, SpaceModule],
  controllers: [McpController],
  providers: [McpServerFactory, McpToolsService, SearchService],
})
export class McpModule {}
