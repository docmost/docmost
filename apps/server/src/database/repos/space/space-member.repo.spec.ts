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
import { SpaceMemberRepo } from './space-member.repo';
import { SpaceRepo } from './space.repo';

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
  const repo = new SpaceMemberRepo(
    db as any,
    {} as any,
    new SpaceRepo(db as any, {} as any),
    {} as any,
  );
  return { repo, queries };
}

const countOf = (sql: string, needle: string) => sql.split(needle).length - 1;

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the parameter bound right after each occurrence of `fragment`
const boundAfter = (query: CompiledQuery, fragment: string) =>
  [...query.sql.matchAll(new RegExp(`${escapeRegExp(fragment)}\\$(\\d+)`, 'g'))].map(
    ([, index]) => query.parameters[Number(index) - 1],
  );

describe('SpaceMemberRepo archived spaces', () => {
  let repo: SpaceMemberRepo;
  let queries: CompiledQuery[];

  beforeEach(() => {
    ({ repo, queries } = buildRepo());
  });

  it('leaves archive state alone by default, because access checks use it', () => {
    const { sql } = repo.getUserSpaceIdsQuery('user-1').compile();
    expect(sql).not.toContain('archived_at');
  });

  it('filters archived spaces in both membership branches when asked', () => {
    const { sql } = repo
      .getUserSpaceIdsQuery('user-1', { excludeArchived: true })
      .compile();
    expect(countOf(sql, '"spaces"."archived_at" is null')).toBe(2);
  });

  it('keeps the space the user is in when asked', () => {
    const { sql, parameters } = repo
      .getUserSpaceIdsQuery('user-1', {
        excludeArchived: true,
        keepArchivedSpaceId: 'space-1',
      })
      .compile();
    expect(
      countOf(sql, '("spaces"."archived_at" is null or "spaces"."id" = $'),
    ).toBe(2);
    expect(parameters).toEqual(['user-1', 'space-1', 'user-1', 'space-1']);
  });

  it('lists only active spaces by default', async () => {
    await repo.getUserSpaces(
      'user-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
    );
    expect(queries[0].sql).toContain('"archived_at" is null');
    expect(countOf(queries[0].sql, '"archived_at" is null')).toBe(1);
  });

  it('lists only archived spaces when asked', async () => {
    await repo.getUserSpaces(
      'user-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
      { status: 'archived' },
    );
    expect(queries[0].sql).toContain('"archived_at" is not null');
    expect(queries[0].sql).not.toContain('"archived_at" is null');
  });

  it('lists active and archived spaces together for all', async () => {
    await repo.getUserSpaces(
      'user-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
      { status: 'all' },
    );
    expect(queries[0].sql).not.toContain('"archived_at" is');
  });
});

describe('SpaceMemberRepo getSharedSpacesPaginated', () => {
  const membershipCheck = '"id" in (select "spaces"."id" from "space_members"';

  const sharedSpacesQuery = async (viewerId: string) => {
    const { repo, queries } = buildRepo();
    await repo.getSharedSpacesPaginated(
      'target-1',
      viewerId,
      'ws-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
    );
    return queries[0];
  };

  it('keeps active spaces both people belong to, inside the workspace', async () => {
    const query = await sharedSpacesQuery('viewer-1');

    expect(boundAfter(query, 'where "workspace_id" = ')).toEqual(['ws-1']);
    expect(countOf(query.sql, membershipCheck)).toBe(2);
    expect(boundAfter(query, '"user_id" = ')).toEqual([
      'target-1',
      'target-1',
      'viewer-1',
      'viewer-1',
    ]);
    expect(countOf(query.sql, '"spaces"."archived_at" is null')).toBe(4);
  });

  it('selects basic space details without a member count', async () => {
    const query = await sharedSpacesQuery('viewer-1');

    expect(query.sql).toMatch(
      /^select "id", "name", "slug", "logo" from "spaces" where /,
    );
    expect(query.sql).not.toContain('count(');
  });

  it('checks membership once when people view themselves', async () => {
    const query = await sharedSpacesQuery('target-1');

    expect(boundAfter(query, 'where "workspace_id" = ')).toEqual(['ws-1']);
    expect(countOf(query.sql, membershipCheck)).toBe(1);
    expect(boundAfter(query, '"user_id" = ')).toEqual(['target-1', 'target-1']);
  });
});
