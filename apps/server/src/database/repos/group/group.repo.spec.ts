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
import { GroupRepo } from './group.repo';

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
  return { repo: new GroupRepo(db as any), queries };
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the parameter bound right after each occurrence of `fragment`
const boundAfter = (query: CompiledQuery, fragment: string) =>
  [...query.sql.matchAll(new RegExp(`${escapeRegExp(fragment)}\\$(\\d+)`, 'g'))].map(
    ([, index]) => query.parameters[Number(index) - 1],
  );

describe('GroupRepo getUserGroupsPaginated', () => {
  it("lists the user's live groups in the workspace", async () => {
    const { repo, queries } = buildRepo();

    await repo.getUserGroupsPaginated(
      'user-1',
      'ws-1',
      Object.assign(new PaginationOptions(), { limit: 50 }),
    );

    const [query] = queries;
    expect(boundAfter(query, '"group_users"."user_id" = ')).toEqual(['user-1']);
    expect(boundAfter(query, '"groups"."workspace_id" = ')).toEqual(['ws-1']);
    expect(query.sql).toContain('"groups"."deleted_at" is null');
  });
});
