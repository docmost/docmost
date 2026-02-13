import {
  Controller,
  Post,
  Get,
  Delete,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServerFactory } from './services/mcp-server.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private mcpServerFactory: McpServerFactory) {}

  @SkipTransform()
  @Post('/')
  async handlePost(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const server = this.mcpServerFactory.createServer(user, workspace);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      await server.connect(transport);

      // Hijack Fastify response to write directly via Node.js HTTP
      reply.hijack();
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (error) {
      this.logger.error('MCP request error', error);
      if (!reply.sent) {
        reply.status(500).send({ error: 'Internal MCP error' });
      }
    }
  }

  @SkipTransform()
  @Get('/')
  async handleGet(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    // Stateless mode: GET not supported for SSE
    reply.status(405).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Use POST for stateless MCP requests.',
      },
      id: null,
    });
  }

  @SkipTransform()
  @Delete('/')
  async handleDelete(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    // Stateless mode: no sessions to terminate
    reply.status(405).send({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Session management not supported in stateless mode.',
      },
      id: null,
    });
  }
}
