import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { executeTx } from '../../utils';
import {
  InsertablePage,
  Page,
  UpdatablePage,
} from '@docmost/db/types/entity.types';
import { sql } from 'kysely';
import { PaginationOptions } from 'src/helpers/pagination/pagination-options';
import { OrderingEntity } from 'src/core/page/page.util';
import { PageWithOrderingDto } from 'src/core/page/dto/page-with-ordering.dto';

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
    'shareId',
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
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .updateTable('pages')
          .set(updatablePage)
          .where('id', '=', pageId)
          .execute();
      },
      trx,
    );
  }

  async insertPage(
    insertablePage: InsertablePage,
    trx?: KyselyTransaction,
  ): Promise<Page> {
    return await executeTx(
      this.db,
      async (trx) => {
        return await trx
          .insertInto('pages')
          .values(insertablePage)
          .returningAll()
          .executeTakeFirst();
      },
      trx,
    );
  }

  async deletePage(pageId: string): Promise<void> {
    await this.db.deleteFrom('pages').where('id', '=', pageId).execute();
  }

  async getRecentPagesInSpace(
    spaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    return executeTx(this.db, async (trx) => {
      const pages = await trx
        .selectFrom('pages')
        .select(this.baseFields)
        .where('spaceId', '=', spaceId)
        .orderBy('updatedAt', 'desc')
        .limit(paginationOptions.limit)
        .offset(paginationOptions.offset)
        .execute();

      let { count } = await trx
        .selectFrom('pages')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('spaceId', '=', spaceId)
        .executeTakeFirst();

      count = count as number;
      return { pages, count };
    });
  }

  async getSpaceSidebarPages(spaceId: string, limit: number) {
    const pages = await this.db
      .selectFrom('pages as page')
      .innerJoin('page_ordering as ordering', 'ordering.entityId', 'page.id')
      .where('ordering.entityType', '=', OrderingEntity.PAGE)
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
      .orderBy('page.createdAt', 'desc')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .execute();

    return pages;
  }
}
