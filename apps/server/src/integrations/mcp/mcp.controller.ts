import { Controller, Delete, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { McpService } from './mcp.service';
import { TokenService } from '../../core/auth/services/token.service';
import { ApiKeyService } from '../../core/api-key/api-key.service';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { extractBearerTokenFromHeader } from '../../common/helpers';

// Loaded via require for the same reason as in mcp.service.ts (SDK module layout).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

@Public()
@SkipTransform()
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly tokenService: TokenService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post()
  async handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const token = extractBearerTokenFromHeader(req);
    if (!token) {
      return this.sendJson(reply, 401, { error: 'Missing API key' }, true);
    }

    let user;
    let workspace;
    try {
      const payload = await this.tokenService.verifyJwt(token, JwtType.API_KEY);
      const result = await this.apiKeyService.validateApiKey(payload);
      user = result.user;
      workspace = result.workspace;
    } catch (err) {
      return this.sendJson(reply, 401, { error: 'Invalid API key' }, true);
    }

    const settings = workspace.settings as { ai?: { mcp?: boolean } } | null;
    if (settings?.ai?.mcp !== true) {
      return this.sendJson(reply, 403, {
        error: 'MCP is not enabled for this workspace',
      });
    }

    const server = this.mcpService.buildServer(user, workspace);
    const transport = new StreamableHTTPServerTransport({
      // stateless: a fresh server/transport per request, no session store
      sessionIdGenerator: undefined,
    });

    reply.raw.on('close', () => {
      transport.close?.();
      server.close?.();
    });

    try {
      await server.connect(transport);
      reply.hijack();
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      this.logger.error(`MCP request failed: ${(err as Error)?.message ?? err}`);
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.setHeader('content-type', 'application/json');
        reply.raw.end(JSON.stringify({ error: 'MCP request failed' }));
      }
    }
  }

  // Stateless server: GET (SSE) and DELETE (session teardown) are not supported.
  @Get()
  async handleGet(@Res() reply: FastifyReply) {
    return this.methodNotAllowed(reply);
  }

  @Delete()
  async handleDelete(@Res() reply: FastifyReply) {
    return this.methodNotAllowed(reply);
  }

  private sendJson(
    reply: FastifyReply,
    status: number,
    body: unknown,
    bearer = false,
  ) {
    reply.hijack();
    reply.raw.statusCode = status;
    reply.raw.setHeader('content-type', 'application/json');
    if (bearer) {
      reply.raw.setHeader('www-authenticate', 'Bearer');
    }
    reply.raw.end(JSON.stringify(body));
  }

  private methodNotAllowed(reply: FastifyReply) {
    this.sendJson(reply, 405, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST.' },
      id: null,
    });
  }
}
