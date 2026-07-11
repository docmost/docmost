import { NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ClsService } from 'nestjs-cls';
export interface AuditContext {
    workspaceId: string | null;
    actorId: string | null;
    actorType: 'user' | 'system' | 'api_key';
    ipAddress: string | null;
    userAgent: string | null;
}
export declare const AUDIT_CONTEXT_KEY = "auditContext";
export declare class AuditContextMiddleware implements NestMiddleware {
    private readonly cls;
    constructor(cls: ClsService);
    use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void;
}
