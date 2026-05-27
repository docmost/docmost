import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { ListAuditDto } from './dto/list-audit.dto';

export interface AuditLogParams {
  actorId?: string;
  action: string;
  entityKind: string;
  entityId: string;
  payloadDiff?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async log(params: AuditLogParams): Promise<void> {
    await this.db
      .insertInto('docops_audit_logs' as any)
      .values({
        actor_id: params.actorId ?? null,
        action: params.action,
        entity_kind: params.entityKind,
        entity_id: params.entityId,
        payload_diff: params.payloadDiff
          ? sql`${JSON.stringify(params.payloadDiff)}::jsonb`
          : null,
        ip: params.ip ?? null,
        user_agent: params.userAgent ?? null,
      })
      .execute();
  }

  async listLogs(dto: ListAuditDto, authUser: User) {
    await this.assertAdmin(authUser.id);

    let query = this.db
      .selectFrom('docops_audit_logs as al' as any)
      .selectAll('al' as any)
      .limit(dto.limit ?? 50)
      .offset(dto.offset ?? 0)
      .orderBy('al.created_at' as any, 'desc');

    if (dto.actorId) {
      query = query.where('al.actor_id' as any, '=', dto.actorId);
    }
    if (dto.action) {
      query = query.where('al.action' as any, '=', dto.action);
    }
    if (dto.entityKind) {
      query = query.where('al.entity_kind' as any, '=', dto.entityKind);
    }
    if (dto.entityId) {
      query = query.where('al.entity_id' as any, '=', dto.entityId);
    }
    if (dto.from) {
      query = query.where('al.created_at' as any, '>=', new Date(dto.from));
    }
    if (dto.to) {
      query = query.where('al.created_at' as any, '<=', new Date(dto.to));
    }

    const items = await query.execute();

    const totalResult = await this.db
      .selectFrom('docops_audit_logs' as any)
      .select(this.db.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return {
      items,
      total: Number(totalResult?.count ?? 0),
      limit: dto.limit ?? 50,
      offset: dto.offset ?? 0,
    };
  }

  private async assertAdmin(userId: string): Promise<void> {
    const result = await sql<{ docopsRoles: string[] }>`
      SELECT docops_roles FROM users WHERE id = ${userId}
    `.execute(this.db);
    const roles: string[] = result.rows[0]?.docopsRoles ?? [];
    if (!roles.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }
}
