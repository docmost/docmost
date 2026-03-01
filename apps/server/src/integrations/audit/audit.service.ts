import { Injectable } from '@nestjs/common';
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
  logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): void | Promise<void>;
  logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): void | Promise<void>;
  setActorId(actorId: string): void;
  setActorType(actorType: ActorType): void;
  updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): void | Promise<void>;
};

export const AUDIT_SERVICE = Symbol('AUDIT_SERVICE');

@Injectable()
export class NoopAuditService implements IAuditService {
  log(_payload: AuditLogPayload): void {
    // No-op: swallow the log when EE module is not available
  }

  logWithContext(_payload: AuditLogPayload, _context: AuditLogContext): void {
    // No-op: swallow the log when EE module is not available
  }

  logBatchWithContext(
    _payloads: AuditLogPayload[],
    _context: AuditLogContext,
  ): void {
    // No-op: swallow the log when EE module is not available
  }

  setActorId(_actorId: string): void {
    // No-op
  }

  setActorType(_actorType: ActorType): void {
    // No-op
  }

  updateRetention(
    _workspaceId: string,
    _retentionDays: number,
  ): void {
    // No-op
  }
}
