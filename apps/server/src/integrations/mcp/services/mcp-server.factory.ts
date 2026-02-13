import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolsService } from './mcp-tools.service';
import { User, Workspace } from '@docmost/db/types/entity.types';

@Injectable()
export class McpServerFactory {
  constructor(private mcpToolsService: McpToolsService) {}

  createServer(user: User, workspace: Workspace): McpServer {
    const server = new McpServer({
      name: 'docmost',
      version: '1.0.0',
    });

    this.mcpToolsService.registerTools(server, user, workspace);
    return server;
  }
}
