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
  const authorId = '2a1fc994-2e47-41d1-9bf7-228ac911fe40';
  const otherSpace = 'c37719be-b772-46a9-835b-3cc0855f2f88';
  const filters = Object.assign(new RecentlyUpdatedDto(), { spaceId, limit: 2 });

  async function run(filter: Partial<RecentlyUpdatedDto> = {}) {
    const { repo, queries } = buildRepo();
    await repo.getRecentlyUpdatedPages('viewer', 'workspace', { ...filters, ...filter });
    expect(queries).toHaveLength(1);
    return queries[0];
  }

  it('restricts each destination to the viewer before taking the most recent matches', async () => {
    const query = await run({ spaces: ['@all'], labels: ['review'], excludeLabels: ['obsolete'] });
    expect(query.sql).toContain('"spaces"."slug" as "space_slug"');
    expect(query.sql).toContain('"users"."name" as "last_editor_name"');
    expect(query.sql).toContain('"users"."avatar_url" as "last_editor_avatar_url"');
    expect(query.sql).not.toContain('"content"');
    expect(query.sql).toContain('"pages"."deleted_at" is null');
    expect(query.sql).toContain('"spaces"."deleted_at" is null');
    expect(boundAfter(query, '"pages"."workspace_id" = ')).toEqual(['workspace']);
    expect(boundAfter(query, '"user_id" = ')).toEqual(['viewer', 'viewer']);
    expect(boundAfter(query, 'pp.user_id = ')).toEqual(['viewer']);
    expect(boundAfter(query, 'gu.user_id = ')).toEqual(['viewer']);
    expect(query.sql).toContain('p.id = pages.id');
    expect(query.sql).toMatch(/not exists \(select "page_labels"\."page_id"/);
    expect(boundAfter(query, '"labels"."name" in (')).toEqual(['review', 'obsolete']);
    expect(countOf(query.sql, ' limit ')).toBe(1);
    expect(query.sql).toMatch(/order by "pages"\."updated_at" desc, "pages"\."id" desc limit \$\d+$/);
    expect(query.parameters[query.parameters.length - 1]).toBe(2);
  });

  it('uses the same feed query for legacy author filters', async () => {
    const options = { spaces: ['@all'], labels: ['+review'] };
    const legacyOptions = { ...options, authors: [authorId, '-?missing'] };
    const ordinary = await run(options);
    const legacy = await run(legacyOptions);
    expect(legacy.sql).toBe(ordinary.sql);
    expect(legacy.parameters).toEqual(ordinary.parameters);
  });

  it('defaults to this space, unions plain spaces and lets a required space take precedence', async () => {
    expect(boundAfter(await run(), '"pages"."space_id" = ')).toEqual([spaceId]);
    const either = await run({ spaces: [otherSpace, '@self'] });
    expect(either.sql).toMatch(/"pages"\."space_id" = \$\d+ or "pages"\."space_id" = /);
    expect(boundAfter(either, '"pages"."space_id" = ')).toEqual([otherSpace, spaceId]);
    const required = await run({ spaces: ['+' + otherSpace, '@self'] });
    expect(boundAfter(required, '"pages"."space_id" = ')).toEqual([otherSpace]);
  });

  it('limits a negative-only filter to accessible spaces, including viewer-relative favorites', async () => {
    const query = await run({ spaces: ['-@favourite', '-@global'] });
    expect(query.sql).toContain('"pages"."space_id" in (select "spaces"."id" from "space_members"');
    expect(boundAfter(query, '"favorites"."user_id" = ')).toEqual(['viewer']);
    expect(boundAfter(query, '"spaces"."is_personal" = ')).toEqual([false]);
    expect(boundAfter(query, '"pages"."space_id" = ')).toEqual([]);
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

  it.each([
    { spaces: ['@all', '-?missing'] },
    { spaces: ['-unmapped-space'] },
  ])('does not broaden an unresolved filter %o', async (filter) => {
    expect((await run(filter)).sql).toMatch(/\bfalse\b/);
  });
});
