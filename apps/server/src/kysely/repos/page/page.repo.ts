import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePage,
  Page,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';

// TODO: scope to space/workspace
@Injectable()
export class PageRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof Page> = [
    'id',
    'title',
    'slug',
    'icon',
    'coverPhoto',
    'key',
    'parentPageId',
    'creatorId',
    'lastUpdatedById',
    'spaceId',
    'workspaceId',
    'isLocked',
    'status',
    'publishedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  async findById(
    pageId: string,
    withJsonContent?: boolean,
    withYdoc?: boolean,
  ): Promise<Page> {
    return await this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .where('id', '=', pageId)
      .$if(withJsonContent, (qb) => qb.select('content'))
      .$if(withYdoc, (qb) => qb.select('ydoc'))
      .executeTakeFirst();
  }

  async slug(slug: string): Promise<Page> {
    return await this.db
      .selectFrom('pages')
      .selectAll()
      .where(sql`LOWER(slug)`, '=', sql`LOWER(${slug})`)
      .executeTakeFirst();
  }

  async updatePage(
    updatablePage: UpdatablePage,
    pageId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .updateTable('pages')
      .set(updatablePage)
      .where('id', '=', pageId)
      .executeTakeFirst();
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('pages')
      .values(insertablePage)
      .returningAll()
      .executeTakeFirst();
  }

  async deletePage(pageId: string): Promise<void> {
    await this.db.deleteFrom('pages').where('id', '=', pageId).execute();
  }

  async getRecentPagesInSpace(spaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('pages')
      .select(this.baseFields)
      .where('spaceId', '=', spaceId)
      .orderBy('updatedAt', 'desc');

    const result = executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    return result;
  }

  async getSpaceSidebarPages(spaceId: string, limit: number) {
    const pages = await this.db
      .selectFrom('pages as page')
      .leftJoin('pageOrdering as ordering', 'ordering.entityId', 'page.id')
      .where('page.spaceId', '=', spaceId)
      .select([
        'page.id',
        'page.title',
        'page.icon',
        'page.parentPageId',
        'page.spaceId',
        'ordering.childrenIds',
        'page.creatorId',
        'page.createdAt',
      ])
      .orderBy('page.updatedAt', 'desc')
      .limit(limit)
      .execute();

    return pages;
  }
}
