import { Global, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { ClsService } from 'nestjs-cls';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  AUDIT_CONTEXT_KEY,
  AuditContext,
} from '../../common/middlewares/audit-context.middleware';
import {
  AuditLogContext,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditLogPayload } from '../../common/events/audit-events';
import { EXCLUDED_AUDIT_EVENTS } from '../../common/events/audit-events';
import { sql } from 'kysely';

@Injectable()
export class AuditLogService implements IAuditService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly cls: ClsService,
  ) {}

  log(payload: AuditLogPayload): void {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (!context?.workspaceId) return;
    if (EXCLUDED_AUDIT_EVENTS.has(payload.event)) return;

    void this.insertLog(payload, {
      workspaceId: context.workspaceId,
      actorId: context.actorId ?? undefined,
      actorType: context.actorType,
      ipAddress: context.ipAddress ?? undefined,
    });
  }

  logWithContext(payload: AuditLogPayload, context: AuditLogContext): void {
    if (EXCLUDED_AUDIT_EVENTS.has(payload.event)) return;
    void this.insertLog(payload, context);
  }

  logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): void {
    for (const payload of payloads) {
      if (EXCLUDED_AUDIT_EVENTS.has(payload.event)) continue;
      void this.insertLog(payload, context);
    }
  }

  setActorId(actorId: string): void {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (context) {
      context.actorId = actorId;
      this.cls.set(AUDIT_CONTEXT_KEY, context);
    }
  }

  setActorType(actorType: AuditContext['actorType']): void {
    const context = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (context) {
      context.actorType = actorType;
      this.cls.set(AUDIT_CONTEXT_KEY, context);
    }
  }

  async updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): Promise<void> {
    await this.db
      .updateTable('workspaces')
      .set({ auditRetentionDays: retentionDays, updatedAt: new Date() })
      .where('id', '=', workspaceId)
      .execute();
  }

  private async insertLog(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): Promise<void> {
    await this.db
      .insertInto('audit')
      .values({
        workspaceId: context.workspaceId,
        actorId: context.actorId ?? null,
        actorType: context.actorType ?? 'user',
        event: payload.event,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId ?? null,
        spaceId: payload.spaceId ?? null,
        changes: payload.changes ?? null,
        metadata: payload.metadata ?? null,
        ipAddress: context.ipAddress
          ? sql`${context.ipAddress}::inet`
          : null,
      })
      .execute();
  }
}
