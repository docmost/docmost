import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { FavoriteRepo } from './favorite.repo';

function buildRepo() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
    log: (event) => {
      if (event.level === 'query') queries.push(event.query);
    },
  });
  const spaceMemberRepo = new SpaceMemberRepo(
    db as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const repo = new FavoriteRepo(db as any, spaceMemberRepo);
  return { repo, queries };
}

const pagination = Object.assign(new PaginationOptions(), { limit: 20 });
const archivedFilter = '"spaces"."archived_at" is null';

describe('FavoriteRepo archived spaces', () => {
  it('keeps archived favorites in the list', async () => {
    const { repo, queries } = buildRepo();

    await repo.findUserFavorites('user-1', 'ws-1', pagination);

    expect(queries[0].sql).not.toContain(archivedFilter);
  });
});
