import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { PagePermissionRepo } from './page-permission.repo';

function buildDb() {
  return new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the parameter bound right after each occurrence of `fragment`
const boundAfter = (query: CompiledQuery, fragment: string) =>
  [...query.sql.matchAll(new RegExp(`${escapeRegExp(fragment)}\\$(\\d+)`, 'g'))].map(
    ([, index]) => query.parameters[Number(index) - 1],
  );

describe('PagePermissionRepo canUserAccessPageExpression', () => {
  let query: CompiledQuery;
  let text: string;

  beforeEach(() => {
    const db = buildDb();
    query = new PagePermissionRepo(db as any, {} as any, {} as any)
      .canUserAccessPageExpression('user-1')
      .compile(db);
    text = query.sql.replace(/\s+/g, ' ').trim();
  });

  it('walks up from the outer pages row through every ancestor once, trashed or in another space', () => {
    expect(text).toContain(
      'with recursive ancestors as ( select p.id, p.parent_page_id from pages p where p.id = pages.id union select p.id, p.parent_page_id from pages p join ancestors a on p.id = a.parent_page_id )',
    );
    expect(text).not.toMatch(/space_id|deleted_at/);
  });

  it('refuses when any of them has a restriction without a permission for the user', () => {
    expect(text.startsWith('not exists (')).toBe(true);
    expect(text).toContain(
      'select 1 from ancestors a join page_access pa on pa.page_id = a.id where not exists ( select 1 from page_permissions pp where pp.page_access_id = pa.id and (pp.user_id = $',
    );
  });

  it('binds the user directly and through their groups', () => {
    expect(boundAfter(query, 'pp.user_id = ')).toEqual(['user-1']);
    expect(boundAfter(query, 'gu.user_id = ')).toEqual(['user-1']);
    expect(query.parameters).toEqual(['user-1', 'user-1']);
  });
});
