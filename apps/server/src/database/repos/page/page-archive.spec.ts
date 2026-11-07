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
import { PageRepo } from './page.repo';

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
  const repo = new PageRepo(db as any, spaceMemberRepo, {} as any);
  return { repo, queries };
}

const pagination = Object.assign(new PaginationOptions(), { limit: 20 });
const archivedFilter = '"spaces"."archived_at" is null';

describe('PageRepo archived spaces', () => {
  it('leaves archived spaces out of recent pages', async () => {
    const { repo, queries } = buildRepo();

    await repo.getRecentPages('user-1', pagination);

    expect(queries[0].sql).toContain(archivedFilter);
  });

  it('leaves archived spaces out of created-by across spaces', async () => {
    const { repo, queries } = buildRepo();

    await repo.getCreatedByPages('user-1', 'user-1', pagination);

    expect(queries[0].sql).toContain(archivedFilter);
  });

  it('keeps created-by inside a space unfiltered', async () => {
    const { repo, queries } = buildRepo();

    await repo.getCreatedByPages('user-1', 'user-1', pagination, 'space-1');

    expect(queries[0].sql).not.toContain('archived_at');
  });
});
