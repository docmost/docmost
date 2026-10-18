import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { SpaceRepo } from './space.repo';

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
  const eventEmitter = { emit: jest.fn() };
  return { repo: new SpaceRepo(db as any, eventEmitter as any), queries };
}

const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('SpaceRepo.updateApprovalSettings', () => {
  it('merges the settings into the approval object and drops the disabling flag', async () => {
    const { repo, queries } = makeRepo();

    await repo.updateApprovalSettings('space-1', 'ws-1', {
      enabled: true,
      approverIds: ['user-1', 'user-2'],
      enabledAt: '2026-10-18T10:00:00.000Z',
      enabledById: 'user-1',
    });

    expect(queries).toHaveLength(1);
    const sql = flat(queries[0].sql);
    expect(sql).toContain('update "spaces" set "settings" =');
    expect(sql).toContain(
      `COALESCE(settings, '{}'::jsonb) || jsonb_build_object('approval',`,
    );
    expect(sql).toContain(
      // ::text first, or postgres.js encodes the JSON string a second time
      `(CASE WHEN jsonb_typeof(settings->'approval') = 'object' THEN settings->'approval' ELSE '{}'::jsonb END - 'disabling') || $1::text::jsonb`,
    );
    expect(sql).toContain('"workspace_id" = ');
    expect(JSON.parse(queries[0].parameters[0] as string)).toEqual({
      enabled: true,
      approverIds: ['user-1', 'user-2'],
      enabledAt: '2026-10-18T10:00:00.000Z',
      enabledById: 'user-1',
    });
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['space-1', 'ws-1']),
    );
  });

  it('leaves out keys that are not given, so the merge keeps them', async () => {
    const { repo, queries } = makeRepo();

    await repo.updateApprovalSettings('space-1', 'ws-1', {
      enabled: false,
      approverIds: ['user-1'],
    });

    expect(JSON.parse(queries[0].parameters[0] as string)).toEqual({
      enabled: false,
      approverIds: ['user-1'],
    });
  });
});

describe('SpaceRepo.markApprovalDisabling', () => {
  it('sets the disabling flag inside the approval object', async () => {
    const { repo, queries } = makeRepo();

    await repo.markApprovalDisabling('space-1', 'ws-1');

    expect(queries).toHaveLength(1);
    const sql = flat(queries[0].sql);
    expect(sql).toContain('update "spaces" set "settings" =');
    expect(sql).toContain(
      `CASE WHEN jsonb_typeof(settings->'approval') = 'object' THEN settings->'approval' ELSE '{}'::jsonb END || '{"disabling": true}'::jsonb`,
    );
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['space-1', 'ws-1']),
    );
  });
});

describe('SpaceRepo.findApprovalPagesToRelease', () => {
  it('lists non-base pages, trashed included, with a draft or a space-owned approval row', async () => {
    const { repo, queries } = makeRepo();

    const ids = await repo.findApprovalPagesToRelease('space-1');

    expect(ids).toEqual([]);
    expect(queries).toHaveLength(1);
    const { parameters } = queries[0];
    const sql = flat(queries[0].sql);
    expect(sql).toContain('select "pages"."id" from "pages"');
    expect(sql).toContain('"pages"."space_id" = $1');
    expect(sql).toContain('"pages"."is_base" = $2');
    expect(sql).toContain(
      'not exists (select "page_verifications"."id" from "page_verifications" where "page_verifications"."page_id" = "pages"."id" and "page_verifications"."type" = $3 and "page_verifications"."source" <> $4)',
    );
    expect(sql).toContain(
      'exists (select "page_drafts"."id" from "page_drafts" where "page_drafts"."page_id" = "pages"."id")',
    );
    expect(sql).toContain(
      'exists (select "page_verifications"."id" from "page_verifications" where "page_verifications"."page_id" = "pages"."id" and "page_verifications"."type" = $5 and "page_verifications"."source" = $6)',
    );
    expect(sql).toContain('order by "pages"."id"');
    expect(sql).not.toContain('deleted_at');
    expect(parameters).toEqual([
      'space-1',
      false,
      'qms',
      'space',
      'qms',
      'space',
    ]);
  });
});

// Methods that require a transaction get the fake db, which has the same builder API.
describe('SpaceRepo.clearUncontrolledReaderVersions', () => {
  it('clears only the reader version of pages without an approval row of their own', async () => {
    const { repo, queries } = makeRepo();
    const trx = (repo as any).db;

    await repo.clearUncontrolledReaderVersions('space-1', trx);

    expect(queries).toHaveLength(1);
    const sql = flat(queries[0].sql);
    expect(sql).toContain('update "pages" set "reader_version_id" = $1');
    expect(sql).toContain('"space_id" = $2');
    expect(sql).toContain('"reader_version_id" is not null');
    expect(sql).toContain(
      'not exists (select "page_verifications"."id" from "page_verifications" where "page_verifications"."page_id" = "pages"."id" and "page_verifications"."type" = $3)',
    );
    expect(sql).not.toContain('updated_at');
    expect(queries[0].parameters).toEqual([null, 'space-1', 'qms']);
  });
});

describe('SpaceRepo.findExpiringVerificationPageIds', () => {
  it('lists pages of the space with an expiring verification, bases excluded', async () => {
    const { repo, queries } = makeRepo();
    const trx = (repo as any).db;

    await repo.findExpiringVerificationPageIds('space-1', trx);

    expect(queries).toHaveLength(1);
    const sql = flat(queries[0].sql);
    expect(sql).toContain(
      'select "page_verifications"."page_id" from "page_verifications" inner join "pages" on "pages"."id" = "page_verifications"."page_id"',
    );
    expect(sql).toContain('"pages"."space_id" = $1');
    expect(sql).toContain('"pages"."is_base" = $2');
    expect(sql).toContain('"page_verifications"."type" = $3');
    expect(queries[0].parameters).toEqual(['space-1', false, 'expiring']);
  });
});

describe('SpaceRepo.removeQmsPageApprovers', () => {
  it('deletes the approvers of approval rows in the space and returns who was removed', async () => {
    const { repo, queries } = makeRepo();
    const trx = (repo as any).db;

    const removed = await repo.removeQmsPageApprovers('space-1', trx);

    expect(removed).toEqual([]);
    expect(queries).toHaveLength(1);
    const sql = flat(queries[0].sql);
    expect(sql).toContain(
      'delete from "page_verifiers" using "page_verifications", "pages"',
    );
    expect(sql).toContain(
      '"page_verifications"."id" = "page_verifiers"."page_verification_id"',
    );
    expect(sql).toContain('"pages"."id" = "page_verifications"."page_id"');
    expect(sql).toContain('"pages"."space_id" = $1');
    expect(sql).toContain('"pages"."is_base" = $2');
    expect(sql).toContain('"page_verifications"."type" = $3');
    expect(sql).toContain(
      'returning "page_verifications"."page_id", "page_verifiers"."user_id"',
    );
    expect(queries[0].parameters).toEqual(['space-1', false, 'qms']);
  });
});
