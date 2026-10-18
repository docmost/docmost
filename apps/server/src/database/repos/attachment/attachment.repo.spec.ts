import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { AttachmentRepo } from './attachment.repo';

type Query = { sql: string; parameters: readonly unknown[] };

// Kysely over a fake driver, so the SQL compiles for real.
function makeRepo() {
  const queries: Query[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      queries.push({ sql: compiled.sql, parameters: compiled.parameters });
      return { rows: [] };
    },
    streamQuery: async function* () {},
  };
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return { repo: new AttachmentRepo(db as any), queries };
}

describe('AttachmentRepo.markPublished', () => {
  it('only publishes unpublished, live page files of the given workspace', async () => {
    const { repo, queries } = makeRepo();

    await repo.markPublished('ws-1', ['att-1', 'att-2']);

    expect(queries).toHaveLength(1);
    const { sql, parameters } = queries[0];
    expect(sql).toContain('update "attachments" set "published_at" = now()');
    expect(sql).toContain('"id" in ($1, $2)');
    expect(sql).toContain('"workspace_id" = $3');
    expect(sql).toContain('"type" = $4');
    expect(sql).toContain('"published_at" is null');
    expect(sql).toContain('"deleted_at" is null');
    expect(parameters).toEqual(['att-1', 'att-2', 'ws-1', 'file']);
  });

  it('skips the query for an empty list', async () => {
    const { repo, queries } = makeRepo();

    await repo.markPublished('ws-1', []);

    expect(queries).toHaveLength(0);
  });
});

describe('AttachmentRepo.markPublishedForPage', () => {
  it('publishes the page own files and files whose owner page is not approval-controlled', async () => {
    const { repo, queries } = makeRepo();

    await repo.markPublishedForPage('ws-1', 'page-1', ['att-1', 'att-2']);

    expect(queries).toHaveLength(1);
    const { sql, parameters } = queries[0];
    expect(sql).toContain('update "attachments" set "published_at" = now()');
    expect(sql).toContain('"id" in ($1, $2)');
    expect(sql).toContain('"workspace_id" = $3');
    expect(sql).toContain('"type" = $4');
    expect(sql).toContain('"published_at" is null');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"page_id" = $5 or not exists');
    expect(sql).toContain('from "pages" as "owner_page"');
    expect(sql).toContain('"owner_page"."id" = "attachments"."page_id"');
    expect(sql).toContain('not "owner_page"."is_base"');
    expect(sql).toContain("controlled_pv.type = 'qms'");
    expect(sql).toContain('controlled_sp.id = "owner_page"."space_id"');
    expect(parameters).toEqual(['att-1', 'att-2', 'ws-1', 'file', 'page-1']);
  });

  it('skips the query for an empty list', async () => {
    const { repo, queries } = makeRepo();

    await repo.markPublishedForPage('ws-1', 'page-1', []);

    expect(queries).toHaveLength(0);
  });
});
