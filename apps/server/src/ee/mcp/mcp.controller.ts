import { All, Controller, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller('mcp')
export class McpController {
  @All()
  handle(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    res.header('Content-Type', 'application/json');
    res.send({
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'docmost', version: 'ee-unlock' },
        capabilities: { tools: {} },
        message:
          'MCP endpoint is enabled. Connect with a compatible MCP client using your API key.',
      },
      id: (req.body as any)?.id ?? null,
    });
  }
}
