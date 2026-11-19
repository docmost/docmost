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
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupUserRepo } from './group-user.repo';

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
  const userRepo = new UserRepo(db as any);
  return {
    repo: new GroupUserRepo(db as any, {} as any, userRepo),
    userRepo,
    queries,
  };
}

const column = (field: string) =>
  `"users"."${field.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())}"`;

const pagination = () => Object.assign(new PaginationOptions(), { limit: 20 });

describe('GroupUserRepo getGroupUsersPaginated', () => {
  it('selects only the member fields for members', async () => {
    const { repo, userRepo, queries } = buildRepo();

    await repo.getGroupUsersPaginated('g-1', pagination());

    const { sql } = queries[0];
    for (const field of userRepo.memberFields) {
      expect(sql).toContain(column(field));
    }
    expect(sql).not.toContain('"users".*');
    for (const field of [
      'password',
      'timezone',
      'locale',
      'scimExternalId',
      'invitedById',
      'lastActiveAt',
      ...userRepo.adminFields,
    ]) {
      expect(sql).not.toContain(column(field));
    }
  });

  it('adds the admin fields, join dates included, for admins', async () => {
    const { repo, userRepo, queries } = buildRepo();

    await repo.getGroupUsersPaginated('g-1', pagination(), { adminView: true });

    for (const field of userRepo.adminFields) {
      expect(queries[0].sql).toContain(column(field));
    }
    expect(queries[0].sql).toContain(column('createdAt'));
    expect(queries[0].sql).not.toContain(column('locale'));
  });
});
