import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  @Get()
  async info(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return {
      name: 'docmost-mcp',
      version: 'ee-shim',
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tools: ['get_current_user'],
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async handleRpc(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const id = body?.id ?? null;
    const method = body?.method;

    if (!method) {
      throw new BadRequestException('JSON-RPC method is required');
    }

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'docmost-mcp',
            version: 'ee-shim',
          },
        },
      };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_current_user',
              description: 'Return the currently authenticated Docmost user.',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        },
      };
    }

    if (method === 'tools/call') {
      if (body?.params?.name !== 'get_current_user') {
        throw new BadRequestException('Unsupported MCP tool');
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                  },
                  workspace: {
                    id: workspace.id,
                    name: workspace.name,
                  },
                },
                null,
                2,
              ),
            },
          ],
          structuredContent: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            workspace: {
              id: workspace.id,
              name: workspace.name,
            },
          },
        },
      };
    }

    if (method === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    }

    throw new BadRequestException(`Unsupported MCP method: ${method}`);
  }
}
