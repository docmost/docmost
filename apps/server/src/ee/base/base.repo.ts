import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { sql } from 'kysely';
import { JsonValue } from '@docmost/db/types/db';

@Injectable()
export class BaseRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async listBasesInSpace(
    spaceId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    const query = this.db
      .selectFrom('pages')
      .selectAll()
      .where('spaceId', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc');

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'position', direction: 'asc' }],
      parseCursor: (cursor) => ({ position: cursor.position as string }),
    });
  }

  async getProperties(pageId: string) {
    return this.db
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc')
      .execute();
  }

  async getProperty(pageId: string, propertyId: string) {
    return this.db
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async insertProperty(
    data: {
      id: string;
      pageId: string;
      name: string;
      type: string;
      position: string;
      typeOptions?: JsonValue;
      isPrimary?: boolean;
      workspaceId: string;
    },
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseProperties')
      .values({
        id: data.id,
        pageId: data.pageId,
        name: data.name,
        type: data.type,
        position: data.position,
        typeOptions: data.typeOptions ?? null,
        isPrimary: data.isPrimary ?? false,
        workspaceId: data.workspaceId,
      })
      .returningAll()
      .executeTakeFirst();
  }

  async updateProperty(
    pageId: string,
    propertyId: string,
    data: {
      name?: string;
      type?: string;
      typeOptions?: JsonValue;
      position?: string;
      pendingType?: string | null;
      pendingTypeOptions?: JsonValue | null;
      pendingToken?: string | null;
    },
  ) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.type !== undefined) update.type = data.type;
    if (data.typeOptions !== undefined) update.typeOptions = data.typeOptions;
    if (data.position !== undefined) update.position = data.position;
    if (data.pendingType !== undefined) update.pendingType = data.pendingType;
    if (data.pendingTypeOptions !== undefined) {
      update.pendingTypeOptions = data.pendingTypeOptions;
    }
    if (data.pendingToken !== undefined) update.pendingToken = data.pendingToken;

    return this.db
      .updateTable('baseProperties')
      .set(update)
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async softDeleteProperty(pageId: string, propertyId: string) {
    await this.db
      .updateTable('baseProperties')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .execute();
  }

  async getViews(pageId: string) {
    return this.db
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy('position', 'asc')
      .execute();
  }

  async getView(pageId: string, viewId: string) {
    return this.db
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .executeTakeFirst();
  }

  async insertView(
    data: {
      pageId: string;
      name: string;
      type: string;
      position: string;
      config?: JsonValue;
      creatorId: string;
      workspaceId: string;
    },
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseViews')
      .values({
        pageId: data.pageId,
        name: data.name,
        type: data.type,
        position: data.position,
        config: data.config ?? {},
        creatorId: data.creatorId,
        workspaceId: data.workspaceId,
      })
      .returningAll()
      .executeTakeFirst();
  }

  async updateView(
    pageId: string,
    viewId: string,
    data: {
      name?: string;
      type?: string;
      position?: string;
      config?: JsonValue;
    },
  ) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.type !== undefined) update.type = data.type;
    if (data.position !== undefined) update.position = data.position;
    if (data.config !== undefined) update.config = data.config;

    return this.db
      .updateTable('baseViews')
      .set(update)
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteView(pageId: string, viewId: string) {
    await this.db
      .deleteFrom('baseViews')
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .execute();
  }

  async getRow(pageId: string, rowId: string) {
    return this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async listRows(
    pageId: string,
    pagination: PaginationOptions,
  ) {
    const query = this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'asc');

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'position', direction: 'asc' }],
      parseCursor: (cursor) => ({ position: cursor.position as string }),
    });
  }

  async getLastRowPosition(pageId: string) {
    const row = await this.db
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.position ?? null;
  }

  async getLastPropertyPosition(pageId: string) {
    const prop = await this.db
      .selectFrom('baseProperties')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy('position', 'desc')
      .limit(1)
      .executeTakeFirst();
    return prop?.position ?? null;
  }

  async insertRow(
    data: {
      pageId: string;
      position: string;
      cells?: JsonValue;
      creatorId: string;
      lastUpdatedById?: string;
      workspaceId: string;
    },
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('baseRows')
      .values({
        pageId: data.pageId,
        position: data.position,
        cells: data.cells ?? {},
        creatorId: data.creatorId,
        lastUpdatedById: data.lastUpdatedById ?? data.creatorId,
        workspaceId: data.workspaceId,
      })
      .returningAll()
      .executeTakeFirst();
  }

  async updateRow(
    pageId: string,
    rowId: string,
    data: {
      cells?: JsonValue;
      position?: string;
      lastUpdatedById?: string;
    },
  ) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.cells !== undefined) update.cells = data.cells;
    if (data.position !== undefined) update.position = data.position;
    if (data.lastUpdatedById !== undefined) {
      update.lastUpdatedById = data.lastUpdatedById;
    }

    return this.db
      .updateTable('baseRows')
      .set(update)
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  async softDeleteRow(pageId: string, rowId: string) {
    await this.db
      .updateTable('baseRows')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .execute();
  }

  async softDeleteRows(pageId: string, rowIds: string[]) {
    if (rowIds.length === 0) return;
    await this.db
      .updateTable('baseRows')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', 'in', rowIds)
      .execute();
  }

  async expandPages(pageIds: string[], workspaceId: string) {
    if (pageIds.length === 0) return [];
    return this.db
      .selectFrom('pages')
      .leftJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
        'spaces.id as spaceRefId',
        'spaces.slug as spaceSlug',
        'spaces.name as spaceName',
      ])
      .where('pages.id', 'in', pageIds)
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.deletedAt', 'is', null)
      .execute();
  }

  async markPageAsBase(pageId: string, trx?: KyselyTransaction) {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('pages')
      .set({ isBase: true, updatedAt: new Date() })
      .where('id', '=', pageId)
      .execute();
  }
}
