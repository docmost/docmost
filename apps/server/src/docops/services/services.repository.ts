import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { sql } from 'kysely';

export interface InsertServiceData {
  code: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  ownerId: string;
  lifecycleState?: string;
  spaceId: string;
  rootPageId?: string | null;
}

export interface FindAllServicesOptions {
  search?: string;
  domain?: string;
  lifecycleState?: string;
  tag?: string;
  ownerId?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class ServicesRepository {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByIdOrCode(
    idOrCode: string,
    trx?: KyselyTransaction,
  ): Promise<any> {
    const db = dbOrTx(this.db, trx);
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const col = UUID_RE.test(idOrCode) ? 's.id' : 's.code';
    return (db as any)
      .selectFrom('services as s')
      .selectAll('s')
      .where(col, '=', idOrCode)
      .executeTakeFirst();
  }

  async findAll(
    opts: FindAllServicesOptions,
  ): Promise<{ items: any[]; total: number }> {
    let query = (this.db as any)
      .selectFrom('services as s')
      .selectAll('s')
      .orderBy('s.name', 'asc')
      .limit(opts.limit)
      .offset(opts.offset);

    if (opts.lifecycleState) {
      query = query.where('s.lifecycle_state', '=', opts.lifecycleState);
    }
    if (opts.domain) {
      query = query.where('s.domain', '=', opts.domain);
    }
    if (opts.ownerId) {
      query = query.where('s.owner_id', '=', opts.ownerId);
    }
    if (opts.search) {
      query = query.where(
        sql`to_tsvector('italian', s.name || ' ' || coalesce(s.description, ''))`,
        '@@',
        sql`plainto_tsquery('italian', ${opts.search})`,
      );
    }
    if (opts.tag) {
      query = query.where(
        's.id',
        'in',
        sql`(
          SELECT st.service_id FROM service_tags st
          INNER JOIN tags t ON t.id = st.tag_id
          WHERE t.name = ${opts.tag}
        )`,
      );
    }

    const items = await query.execute();

    let countQuery = (this.db as any)
      .selectFrom('services')
      .select(this.db.fn.countAll<number>().as('count'));

    if (opts.lifecycleState) {
      countQuery = countQuery.where('lifecycle_state', '=', opts.lifecycleState);
    }
    if (opts.domain) {
      countQuery = countQuery.where('domain', '=', opts.domain);
    }
    if (opts.ownerId) {
      countQuery = countQuery.where('owner_id', '=', opts.ownerId);
    }

    const totalResult = await countQuery.executeTakeFirst();

    return { items, total: Number(totalResult?.count ?? 0) };
  }

  async insert(
    data: InsertServiceData,
    trx?: KyselyTransaction,
  ): Promise<any> {
    const db = dbOrTx(this.db, trx);
    return (db as any)
      .insertInto('services')
      .values({
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        domain: data.domain ?? null,
        owner_id: data.ownerId,
        lifecycle_state: data.lifecycleState ?? 'active',
        space_id: data.spaceId,
        root_page_id: data.rootPageId ?? null,
        metadata: sql`'{}'::jsonb`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      domain: string | null;
      ownerId: string;
      lifecycleState: string;
      rootPageId: string;
    }>,
    trx?: KyselyTransaction,
  ): Promise<any> {
    const db = dbOrTx(this.db, trx);
    const updates: Record<string, any> = { updated_at: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.domain !== undefined) updates.domain = data.domain;
    if (data.ownerId !== undefined) updates.owner_id = data.ownerId;
    if (data.lifecycleState !== undefined)
      updates.lifecycle_state = data.lifecycleState;
    if (data.rootPageId !== undefined) updates.root_page_id = data.rootPageId;

    return (db as any)
      .updateTable('services')
      .set(updates)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async retire(id: string, trx?: KyselyTransaction): Promise<any> {
    const db = dbOrTx(this.db, trx);
    return (db as any)
      .updateTable('services')
      .set({ lifecycle_state: 'retired', updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listTags(): Promise<{ id: string; name: string }[]> {
    return (this.db as any)
      .selectFrom('tags')
      .selectAll()
      .orderBy('name', 'asc')
      .execute();
  }

  async getServiceTags(serviceId: string): Promise<string[]> {
    const rows = await sql<{ name: string }>`
      SELECT t.name FROM service_tags st
      INNER JOIN tags t ON t.id = st.tag_id
      WHERE st.service_id = ${serviceId}
      ORDER BY t.name
    `.execute(this.db);
    return rows.rows.map((r) => r.name);
  }

  async upsertTags(
    serviceId: string,
    tags: string[],
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx) as any;
    for (const tagName of tags) {
      const normalized = tagName.trim().toLowerCase();
      if (!normalized) continue;

      let tag = await db
        .selectFrom('tags')
        .select(['id'])
        .where('name', '=', normalized)
        .executeTakeFirst();

      if (!tag) {
        tag = await db
          .insertInto('tags')
          .values({ name: normalized })
          .returning(['id'])
          .executeTakeFirstOrThrow();
      }

      await db
        .insertInto('service_tags')
        .values({ service_id: serviceId, tag_id: tag.id })
        .onConflict((oc: any) => oc.doNothing())
        .execute();
    }
  }

  async clearTags(serviceId: string, trx?: KyselyTransaction): Promise<void> {
    const db = dbOrTx(this.db, trx) as any;
    await db
      .deleteFrom('service_tags')
      .where('service_id', '=', serviceId)
      .execute();
  }

  // Inserts in batches of 100 to stay within pg parameter limit.
  // Returns count of rows attempted (some may be skipped on code conflict).
  async bulkInsert(
    records: InsertServiceData[],
    trx?: KyselyTransaction,
  ): Promise<number> {
    if (records.length === 0) return 0;
    const db = dbOrTx(this.db, trx) as any;
    const BATCH = 100;
    let attempted = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const values = batch.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description ?? null,
        domain: r.domain ?? null,
        owner_id: r.ownerId,
        lifecycle_state: r.lifecycleState ?? 'active',
        space_id: r.spaceId,
        root_page_id: r.rootPageId ?? null,
        metadata: sql`'{}'::jsonb`,
      }));
      await db
        .insertInto('services')
        .values(values)
        .onConflict((oc: any) => oc.column('code').doNothing())
        .execute();
      attempted += batch.length;
    }
    return attempted;
  }
}
