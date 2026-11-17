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
import { GroupUserRepo } from './group-user.repo';

// answers the member list query with the given rows
function buildRepo(rows: object[]) {
  const driver = new DummyDriver();
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (query: CompiledQuery) => ({
        rows: query.sql.includes('from "group_users"') ? rows : [],
      }),
      streamQuery: async function* () {},
    }) as any;
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
  return new GroupUserRepo(db as any, {} as any, {} as any);
}

describe('GroupUserRepo getGroupUsersPaginated', () => {
  it('drops the password hash and timezone from member rows', async () => {
    const repo = buildRepo([
      {
        id: 'u-1',
        name: 'Ada',
        email: 'ada@example.com',
        password: 'hash',
        timezone: 'Europe/London',
      },
    ]);

    const result = await repo.getGroupUsersPaginated(
      'g-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'u-1', name: 'Ada' });
    expect(result.items[0]).not.toHaveProperty('password');
    expect(result.items[0]).not.toHaveProperty('timezone');
  });
});
