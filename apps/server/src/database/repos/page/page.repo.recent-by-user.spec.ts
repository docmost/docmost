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
