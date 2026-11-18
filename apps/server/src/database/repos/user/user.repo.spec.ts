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
import { WorkspaceUserListStatus } from '../../../core/workspace/workspace.constants';
import { UserRepo } from './user.repo';

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
  return { repo: new UserRepo(db as any), queries };
}

describe('UserRepo getUsersPaginated status', () => {
  const listSql = async (status?: WorkspaceUserListStatus) => {
    const { repo, queries } = buildRepo();
    await repo.getUsersPaginated(
      'ws-1',
      Object.assign(new PaginationOptions(), { limit: 20 }),
      { status },
    );
    return queries[0].sql;
  };

  it('lists active users by default', async () => {
    const sql = await listSql();
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"deactivated_at" is null');
  });

  it('lists active users for active', async () => {
    const sql = await listSql('active');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"deactivated_at" is null');
  });

  it('lists deactivated users that are not deleted', async () => {
    const sql = await listSql('deactivated');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"deactivated_at" is not null');
  });

  it('lists deleted users whether or not they were deactivated', async () => {
    const sql = await listSql('deleted');
    expect(sql).toContain('"deleted_at" is not null');
    expect(sql).not.toContain('"deactivated_at" is');
  });

  it('lists every user for all', async () => {
    const sql = await listSql('all');
    expect(sql).not.toContain('"deleted_at" is');
    expect(sql).not.toContain('"deactivated_at" is');
  });
});
