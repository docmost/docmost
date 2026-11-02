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
import { PublicSpaceRepo } from './public-space.repo';

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
  return { repo: new PublicSpaceRepo(db as any), queries };
}

const pagination = Object.assign(new PaginationOptions(), { limit: 20 });
const archivedFilter = '"spaces"."archived_at" is null';

describe('PublicSpaceRepo archived spaces', () => {
  it('leaves archived spaces out of the /docs directory', async () => {
    const { repo, queries } = buildRepo();

    await repo.findEnabledWithSpaceByWorkspaceId('ws-1');

    expect(queries[0].sql).toContain(archivedFilter);
  });

  it('leaves archived spaces out of the published spaces list', async () => {
    const { repo, queries } = buildRepo();

    await repo.getPublishedSpaces('user-1', 'ws-1', pagination);

    expect(queries[0].sql).toContain(archivedFilter);
  });
});
