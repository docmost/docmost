import { InjectKysely } from 'nestjs-kysely';
import { Injectable } from '@nestjs/common';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_CONTEXT_KEY,
  AuditContext,
} from '../../common/middlewares/audit-context.middleware';
import {
  ActorType,
  AuditLogData,
  AuditLogPayload,
} from '../../common/events/audit-events';
import {
  AuditLogContext,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';

@Injectable()
export class EeAuditService implements IAuditService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly cls: ClsService,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async log(payload: AuditLogPayload): Promise<void> {
    const ctx = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    const workspaceId = ctx?.workspaceId;

    if (!workspaceId) {
      return;
    }

    await this.insertMany([
      {
        workspaceId,
        actorId: ctx?.actorId ?? null,
        actorType: ctx?.actorType ?? 'user',
        ipAddress: ctx?.ipAddress ?? null,
        userAgent: ctx?.userAgent ?? null,
        ...payload,
      },
    ]);
  }

  async logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): Promise<void> {
    await this.insertMany([
      {
        workspaceId: context.workspaceId,
        actorId: context.actorId ?? null,
        actorType: context.actorType ?? 'user',
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        ...payload,
      },
    ]);
  }

  async logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): Promise<void> {
    if (payloads.length === 0) {
      return;
    }

    await this.insertMany(
      payloads.map((payload) => ({
        workspaceId: context.workspaceId,
        actorId: context.actorId ?? null,
        actorType: context.actorType ?? 'user',
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        ...payload,
      })),
    );
  }

  setActorId(actorId: string): void {
    const ctx = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (ctx) {
      ctx.actorId = actorId;
      this.cls.set(AUDIT_CONTEXT_KEY, ctx);
      return;
    }

    this.cls.set(AUDIT_CONTEXT_KEY, { actorId } as AuditContext);
  }

  setActorType(actorType: ActorType): void {
    const ctx = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (ctx) {
      ctx.actorType = actorType;
      this.cls.set(AUDIT_CONTEXT_KEY, ctx);
      return;
    }

    this.cls.set(AUDIT_CONTEXT_KEY, { actorType } as AuditContext);
  }

  async updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): Promise<void> {
    await this.workspaceRepo.updateWorkspace(
      { auditRetentionDays: retentionDays },
      workspaceId,
    );
  }

  private async insertMany(payloads: AuditLogData[]): Promise<void> {
    const values = payloads.map((payload) => ({
      workspaceId: payload.workspaceId,
      actorId: payload.actorId ?? null,
      actorType: payload.actorType ?? 'user',
      event: payload.event,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId ?? null,
      spaceId: payload.spaceId ?? null,
      changes: payload.changes ?? null,
      metadata: payload.metadata ?? null,
      ipAddress: payload.ipAddress ?? null,
    }));

    await this.db.insertInto('audit').values(values).execute();
  }
}

