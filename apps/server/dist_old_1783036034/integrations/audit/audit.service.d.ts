import { AuditLogPayload, ActorType } from '../../common/events/audit-events';
export type AuditLogContext = {
    workspaceId: string;
    actorId?: string;
    actorType?: ActorType;
    ipAddress?: string;
    userAgent?: string;
};
export type IAuditService = {
    log(payload: AuditLogPayload): void | Promise<void>;
    logWithContext(payload: AuditLogPayload, context: AuditLogContext): void | Promise<void>;
    logBatchWithContext(payloads: AuditLogPayload[], context: AuditLogContext): void | Promise<void>;
    setActorId(actorId: string): void;
    setActorType(actorType: ActorType): void;
    updateRetention(workspaceId: string, retentionDays: number): void | Promise<void>;
};
export declare const AUDIT_SERVICE: unique symbol;
export declare class NoopAuditService implements IAuditService {
    log(_payload: AuditLogPayload): void;
    logWithContext(_payload: AuditLogPayload, _context: AuditLogContext): void;
    logBatchWithContext(_payloads: AuditLogPayload[], _context: AuditLogContext): void;
    setActorId(_actorId: string): void;
    setActorType(_actorType: ActorType): void;
    updateRetention(_workspaceId: string, _retentionDays: number): void;
}
