import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { dbOrTx } from '@docmost/db/utils';
import { ACTIVE_STATUSES } from './state-machine/cr-state.types';

@Injectable()
export class ChangeRequestsRepository {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(id: string, trx?: KyselyTransaction): Promise<any> {
    const db = dbOrTx(this.db, trx);
    return (db as any)
      .selectFrom('change_requests')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async insert(data: Record<string, any>, trx?: KyselyTransaction): Promise<any> {
    const db = dbOrTx(this.db, trx);
    return (db as any)
      .insertInto('change_requests')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateById(
    id: string,
    updates: Record<string, any>,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await (db as any)
      .updateTable('change_requests')
      .set(updates)
      .where('id', '=', id)
      .execute();
  }

  async insertEvent(
    event: {
      changeRequestId: string;
      fromStatus: string | null;
      toStatus: string;
      actorId: string;
      reason?: string | null;
      metadata?: Record<string, any>;
    },
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await (db as any)
      .insertInto('change_request_events')
      .values({
        change_request_id: event.changeRequestId,
        from_status: event.fromStatus,
        to_status: event.toStatus,
        actor_id: event.actorId,
        reason: event.reason ?? null,
        metadata: sql`'{}'::jsonb`,
      })
      .execute();
  }

  async listWithCount(opts: {
    serviceId?: string;
    status?: string;
    priority?: string;
    requestedById?: string;
    implementerId?: string;
    approverId?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: any[]; total: number }> {
    const applyFilters = (q: any) => {
      if (opts.serviceId) q = q.where('cr.service_id', '=', opts.serviceId);
      if (opts.status) q = q.where('cr.status', '=', opts.status);
      if (opts.priority) q = q.where('cr.priority', '=', opts.priority);
      if (opts.requestedById) q = q.where('cr.requested_by_id', '=', opts.requestedById);
      if (opts.implementerId) q = q.where('cr.implementer_id', '=', opts.implementerId);
      if (opts.approverId) q = q.where('cr.approver_id', '=', opts.approverId);
      if (opts.search) {
        q = q.where(
          sql`to_tsvector('italian', cr.title || ' ' || coalesce(cr.description, '') || ' ' || coalesce(cr.justification, ''))`,
          '@@',
          sql`plainto_tsquery('italian', ${opts.search})`,
        );
      }
      return q;
    };

    let itemsQ = (this.db as any)
      .selectFrom('change_requests as cr')
      .selectAll('cr')
      .limit(opts.limit)
      .offset(opts.offset)
      .orderBy('cr.created_at', 'desc');

    let countQ = (this.db as any)
      .selectFrom('change_requests as cr')
      .select(this.db.fn.countAll<number>().as('count'));

    itemsQ = applyFilters(itemsQ);
    countQ = applyFilters(countQ);

    const [items, countRow] = await Promise.all([
      itemsQ.execute(),
      countQ.executeTakeFirst(),
    ]);

    return { items, total: Number(countRow?.count ?? 0) };
  }

  async getEvents(crId: string): Promise<any[]> {
    const result = await sql<any>`
      SELECT * FROM change_request_events
      WHERE change_request_id = ${crId}
      ORDER BY created_at ASC
    `.execute(this.db);
    return result.rows;
  }

  async getExternalRefs(crId: string): Promise<any[]> {
    const result = await sql<any>`
      SELECT * FROM external_refs
      WHERE change_request_id = ${crId}
      ORDER BY created_at ASC
    `.execute(this.db);
    return result.rows;
  }

  async countActiveCrs(serviceId: string, excludeId: string): Promise<number> {
    const result = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM change_requests
      WHERE service_id = ${serviceId}
      AND status = ANY(${ACTIVE_STATUSES}::text[])
      AND id != ${excludeId}
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  async getExternalRefCount(crId: string): Promise<number> {
    const result = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM external_refs
      WHERE change_request_id = ${crId}
      AND ref_type IN ('PR', 'COMMIT')
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const result = await sql<{ docopsRoles: string[] }>`
      SELECT docops_roles FROM users WHERE id = ${userId}
    `.execute(this.db);
    return result.rows[0]?.docopsRoles ?? [];
  }
}
