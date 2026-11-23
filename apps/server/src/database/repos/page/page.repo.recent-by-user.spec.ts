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
import { RecentlyUpdatedDto } from '../../../core/page/dto/recently-updated.dto';
import { PageRepo } from './page.repo';
import { PagePermissionRepo } from './page-permission.repo';
import { SpaceMemberRepo } from '../space/space-member.repo';
import { SpaceRepo } from '../space/space.repo';

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
    new SpaceRepo(db as any, {} as any),
    {} as any,
  );
  const repo = new PageRepo(
    db as any,
    spaceMemberRepo,
    { emit: jest.fn() } as any,
    new PagePermissionRepo(db as any, {} as any, {} as any),
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

describe('PageRepo getRecentPagesByUser', () => {
  let query: CompiledQuery;

  beforeEach(async () => {
    const { repo, queries } = buildRepo();
    await repo.getRecentPagesByUser(
      'target-1',
      'viewer-1',
      'ws-1',
      Object.assign(new PaginationOptions(), { limit: 10 }),
    );
    [query] = queries;
  });

  it("keeps live pages the target created or last edited in the viewer's workspace", () => {
    expect(boundAfter(query, '"creator_id" = ')).toEqual(['target-1']);
    expect(boundAfter(query, '"last_updated_by_id" = ')).toEqual(['target-1']);
    expect(query.sql).toContain('"deleted_at" is null');
    expect(boundAfter(query, 'where "workspace_id" = ')).toEqual(['ws-1']);
  });

  it("limits pages to the viewer's active spaces", () => {
    expect(query.sql).toContain(
      '"space_id" in (select "spaces"."id" from "space_members"',
    );
    expect(countOf(query.sql, '"spaces"."archived_at" is null')).toBe(2);
  });

  it('keeps only pages the viewer can open', () => {
    const text = query.sql.replace(/\s+/g, ' ');
    expect(text).toContain(
      'from "pages" where "workspace_id" = $',
    );
    expect(text).toContain(
      ' and not exists ( with recursive ancestors as ( select p.id, p.parent_page_id from pages p where p.id = pages.id',
    );
    expect(boundAfter(query, 'pp.user_id = ')).toEqual(['viewer-1']);
    expect(boundAfter(query, 'gu.user_id = ')).toEqual(['viewer-1']);
  });

  it('checks memberships and permissions as the viewer, never the target', () => {
    const userBindings = [
      ...boundAfter(query, '"user_id" = '),
      ...boundAfter(query, '.user_id = '),
    ];
    expect(userBindings).toHaveLength(4);
    expect(new Set(userBindings)).toEqual(new Set(['viewer-1']));
  });
});

describe('PageRepo getRecentlyUpdatedPages', () => {
  const spaceId = '60bbbe22-a503-4935-816f-4ca8a355a9c5';
  const otherSpace = 'c37719be-b772-46a9-835b-3cc0855f2f88';
  const thirdSpace = '2208ef6c-f374-4296-ba08-2b07c71f3cbe';
  const filters = Object.assign(new RecentlyUpdatedDto(), { spaceId, limit: 2 });

  async function run(filter: Partial<RecentlyUpdatedDto> = {}) {
    const { repo, queries } = buildRepo();
    await repo.getRecentlyUpdatedPages('viewer', 'workspace', { ...filters, ...filter });
    expect(queries).toHaveLength(1);
    return queries[0];
  }

  it('restricts each destination to the viewer before taking the most recent matches', async () => {
    const query = await run({ labels: ['review'], excludeLabels: ['obsolete'] });
    expect(query.sql).toContain('"spaces"."slug" as "space_slug"');
    expect(query.sql).toContain('"spaces"."name" as "space_name"');
    expect(query.sql).toContain('"users"."name" as "last_editor_name"');
    expect(query.sql).toContain('"users"."avatar_url" as "last_editor_avatar_url"');
    expect(query.sql).not.toContain('"content"');
    expect(query.sql).toContain('"pages"."deleted_at" is null');
    expect(query.sql).toContain('"spaces"."deleted_at" is null');
    expect(boundAfter(query, '"pages"."workspace_id" = ')).toEqual(['workspace']);
    expect(boundAfter(query, '"user_id" = ')).toEqual(['viewer', 'viewer']);
    expect(
      countOf(query.sql, '"spaces"."archived_at" is null or "spaces"."id" = '),
    ).toBe(2);
    expect(boundAfter(query, '"spaces"."id" = ')).toEqual([spaceId, spaceId]);
    expect(boundAfter(query, 'pp.user_id = ')).toEqual(['viewer']);
    expect(boundAfter(query, 'gu.user_id = ')).toEqual(['viewer']);
    expect(query.sql).toContain('p.id = pages.id');
    expect(query.sql).toMatch(/not exists \(select "page_labels"\."page_id"/);
    expect(boundAfter(query, '"labels"."name" in (')).toEqual(['review', 'obsolete']);
    expect(countOf(query.sql, ' limit ')).toBe(1);
    expect(query.sql).toMatch(/order by "pages"\."updated_at" desc, "pages"\."id" desc limit \$\d+$/);
    expect(query.parameters[query.parameters.length - 1]).toBe(2);
  });

  it('uses just the host space by default and applies exclusions to it', async () => {
    expect(boundAfter(await run(), '"pages"."space_id" = ')).toEqual([spaceId]);
    const query = await run({
      scope: 'current',
      excludeSpaceIds: [spaceId],
    });
    expect(boundAfter(query, '"pages"."space_id" = ')).toEqual([spaceId]);
    expect(boundAfter(query, '"pages"."space_id" not in (')).toEqual([spaceId]);
    expect(query.parameters).not.toContain(otherSpace);
  });

  it('includes every accessible space in workspace scope except excluded IDs', async () => {
    const query = await run({
      scope: 'workspace',
      excludeSpaceIds: [thirdSpace],
    });
    expect(query.sql).toContain('"pages"."space_id" in (select "spaces"."id" from "space_members"');
    expect(boundAfter(query, '"pages"."space_id" = ')).toEqual([]);
    expect(boundAfter(query, '"pages"."space_id" in (')).toEqual([]);
    expect(boundAfter(query, '"pages"."space_id" not in (')).toEqual([thirdSpace]);
    expect(query.parameters).not.toContain(otherSpace);
  });

  it('matches any named space and excludes a space even when it was also included', async () => {
    const query = await run({
      scope: 'spaces',
      spaceIds: [otherSpace, thirdSpace],
      excludeSpaceIds: [thirdSpace],
    });
    expect(query.sql).toMatch(
      /"pages"\."space_id" in \(\$\d+, \$\d+\) and "pages"\."space_id" not in \(\$\d+\)/,
    );
    const firstSpace = query.parameters.indexOf(otherSpace);
    expect(query.parameters.slice(firstSpace, firstSpace + 3)).toEqual([
      otherSpace,
      thirdSpace,
      thirdSpace,
    ]);
  });

  it.each([
    { scope: 'spaces' as const, spaceIds: [] },
    { scope: 'workspace' as const, spaceIds: [otherSpace] },
    { scope: 'current' as const, spaceIds: [otherSpace] },
  ])('returns an empty feed for inconsistent space restrictions %o', async (selection) => {
    const { repo, queries } = buildRepo();
    const rows = await repo.getRecentlyUpdatedPages('viewer', 'workspace', {
      ...filters,
      ...selection,
      labels: ['review'],
      excludeSpaceIds: [otherSpace],
    });
    expect(rows).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it('requires every distinct included label in all mode and respects literal exclusions', async () => {
    const query = await run({ labels: ['Übersicht', 'release', 'RELEASE'], match: 'all', excludeLabels: ['?old'] });
    expect(query.parameters).toEqual(expect.arrayContaining(['übersicht', 'release', '?old']));
    expect(query.sql).toContain('"labels"."workspace_id" = "pages"."workspace_id"');
    expect(boundAfter(query, 'having count("labels"."id") = ')).toEqual([2]);
  });

  it('matches any literal label name, including prefixes, and filters exclusions separately', async () => {
    const query = await run({ labels: ['-draft', '+pending', '?'], excludeLabels: ['-old'] });
    expect(query.parameters).toEqual(expect.arrayContaining(['-draft', '+pending', '?', '-old']));
    expect(query.sql).not.toContain('having count');
    expect(query.sql.match(/not exists \(select "page_labels"/g)).toHaveLength(1);
    expect(query.sql.match(/"labels"\."name" in \(/g)).toHaveLength(2);
  });

  it('can exclude labels without requiring an included label', async () => {
    const query = await run({ excludeLabels: ['draft'] });
    expect(query.sql.match(/exists \(select "page_labels"/g)).toHaveLength(1);
    expect(query.sql).toMatch(/not exists \(select "page_labels"/);
  });
});
