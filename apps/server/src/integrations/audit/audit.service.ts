import { Injectable } from '@nestjs/common';
import { AuditLogPayload, ActorType } from '../../common/events/audit-events';

export type IAuditService = {
  log(payload: AuditLogPayload): void | Promise<void>;
  logWithContext(
    payload: AuditLogPayload,
    context: {
      workspaceId: string;
      actorId?: string;
      actorType?: ActorType;
      ipAddress?: string;
      userAgent?: string;
    },
  ): void | Promise<void>;
  setActorId(actorId: string): void;
  setActorType(actorType: ActorType): void;
};

export const AUDIT_SERVICE = Symbol('AUDIT_SERVICE');

@Injectable()
export class NoopAuditService implements IAuditService {
  log(_payload: AuditLogPayload): void {
    // No-op: swallow the log when EE module is not available
  }

  logWithContext(
    _payload: AuditLogPayload,
    _context: {
      workspaceId: string;
      actorId?: string;
      actorType?: ActorType;
      ipAddress?: string;
      userAgent?: string;
    },
  ): void {
    // No-op: swallow the log when EE module is not available
  }

  setActorId(_actorId: string): void {
    // No-op
  }

  setActorType(_actorType: ActorType): void {
    // No-op
  }
}
