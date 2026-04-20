import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

export type ResolvedPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  space: { id: string; slug: string; name: string } | null;
};

@Injectable()
export class BasePageResolverService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async resolvePages(
    pageIds: string[],
    workspaceId: string,
    userId: string,
  ): Promise<ResolvedPage[]> {
    const unique = Array.from(new Set(pageIds));
    if (unique.length === 0) return [];

    const rows = await this.db
      .selectFrom('pages')
      .select([
        'pages.id',
        'pages.slugId',
        'pages.title',
        'pages.icon',
        'pages.spaceId',
      ])
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug'])
            .whereRef('spaces.id', '=', 'pages.spaceId'),
        ).as('space'),
      )
      .where('pages.id', 'in', unique)
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.deletedAt', 'is', null)
      .execute();

    if (rows.length === 0) return [];

    const accessible = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: rows.map((r) => r.id),
      userId,
    });
    const accessibleSet = new Set(accessible);

    return rows.filter((r) => accessibleSet.has(r.id));
  }
}
