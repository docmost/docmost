import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../types/kysely.types';
import { Page } from '../../types/entity.types';
import { PageMemberRole } from './page-permission-repo.service';

@Injectable()
export class SharedPagesRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async addSharedPage(userId: string, pageId: string): Promise<void> {
    await this.db
      .insertInto('userSharedPages')
      .values({
        userId,
        pageId,
        sharedAt: new Date(),
      })
      .onConflict((oc) => oc.columns(['userId', 'pageId']).doNothing())
      .execute();
  }

  async removeSharedPage(userId: string, pageId: string): Promise<void> {
    await this.db
      .deleteFrom('userSharedPages')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .execute();
  }

  async getUserSharedPages(userId: string): Promise<Page[]> {
    return await this.db
      .selectFrom('userSharedPages as usp')
      .innerJoin('pages as p', 'p.id', 'usp.pageId')
      .innerJoin('pagePermissions as pm', (join) =>
        join
          .onRef('pm.pageId', '=', 'p.id')
          .on('pm.userId', '=', userId)
          .on('pm.role', '!=', PageMemberRole.NONE),
      )
      .selectAll('p')
      .where('usp.userId', '=', userId)
      .where('p.deletedAt', 'is', null)
      .orderBy('usp.sharedAt', 'desc')
      .execute();
  }

  async isPageSharedWithUser(userId: string, pageId: string): Promise<boolean> {
    const result = await this.db
      .selectFrom('userSharedPages')
      .select('userId')
      .where('userId', '=', userId)
      .where('pageId', '=', pageId)
      .executeTakeFirst();

    return !!result;
  }
}
