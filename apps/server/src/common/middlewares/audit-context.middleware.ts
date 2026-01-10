import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ClsService } from 'nestjs-cls';

export interface AuditContext {
  workspaceId: string | null;
  actorId: string | null;
  actorType: 'user' | 'system' | 'api_key';
  ipAddress: string | null;
}

export const AUDIT_CONTEXT_KEY = 'auditContext';

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const workspaceId = (req as any).workspaceId ?? null;
    const ipAddress = this.extractIpAddress(req);

    const auditContext: AuditContext = {
      workspaceId,
      actorId: null,
      actorType: 'user',
      ipAddress,
    };

    this.cls.set(AUDIT_CONTEXT_KEY, auditContext);

    next();
  }

  private extractIpAddress(req: FastifyRequest['raw']): string | null {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      return ips?.trim() ?? null;
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    return (req as any).socket?.remoteAddress ?? null;
  }
}
