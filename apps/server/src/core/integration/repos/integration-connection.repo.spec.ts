import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { IntegrationConnectionRepo } from './integration-connection.repo';

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
  return { repo: new IntegrationConnectionRepo(db as any), queries };
}

describe('IntegrationConnectionRepo personal connections', () => {
  it('states the partial index predicate when finding a personal connection', async () => {
    const { repo, queries } = buildRepo();

    await repo.findByIntegrationAndUser('integration-1', 'user-1');

    expect(queries[0].sql).toBe(
      'select * from "integration_connections" where "integration_id" = $1 and "user_id" = $2 and "kind" = $3',
    );
    expect(queries[0].parameters).toEqual(['integration-1', 'user-1', 'user']);
  });

  it('disconnects only the personal connection, never the workspace bot row', async () => {
    const { repo, queries } = buildRepo();

    await expect(
      repo.deleteByIntegrationAndUser('integration-1', 'user-1'),
    ).resolves.toBe(false);

    expect(queries[0].sql).toBe(
      'delete from "integration_connections" where "integration_id" = $1 and "user_id" = $2 and "kind" = $3',
    );
    expect(queries[0].parameters).toEqual(['integration-1', 'user-1', 'user']);
  });
});

describe('IntegrationConnectionRepo offboarding', () => {
  it('deletes only the personal connections of the user', async () => {
    const { repo, queries } = buildRepo();

    await repo.deleteUserConnections('user-1');

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe(
      'delete from "integration_connections" where "user_id" = $1 and "kind" = $2',
    );
    expect(queries[0].parameters).toEqual(['user-1', 'user']);
  });

  it('skips tokens of deactivated or deleted users but keeps workspace bot rows', async () => {
    const { repo, queries } = buildRepo();

    await repo.findExpiringTokens(60_000, 500);

    const { sql, parameters } = queries[0];
    expect(sql).toContain(
      'inner join "users" on "users"."id" = "integration_connections"."user_id"',
    );
    const kindParam = parameters.indexOf('workspace') + 1;
    expect(kindParam).toBeGreaterThan(0);
    expect(sql).toContain(
      `("integration_connections"."kind" = $${kindParam} or ("users"."deactivated_at" is null and "users"."deleted_at" is null))`,
    );
  });
});

describe('IntegrationConnectionRepo expiring tokens', () => {
  it('loads a capped batch of the soonest-expiring refreshable tokens', async () => {
    const { repo, queries } = buildRepo();
    const before = Date.now();

    await repo.findExpiringTokens(60_000, 500);

    const { sql, parameters } = queries[0];
    const n = parameters.length;
    expect(
      sql.slice(sql.indexOf('"integration_connections"."invalidated_at"')),
    ).toBe(
      `"integration_connections"."invalidated_at" is null and "integration_connections"."refresh_token" is not null and "integration_connections"."token_expires_at" is not null and "integration_connections"."token_expires_at" < $${n - 1} order by "integration_connections"."token_expires_at" asc limit $${n}`,
    );
    expect(parameters[n - 1]).toBe(500);
    const threshold = (parameters[n - 2] as Date).getTime();
    expect(threshold).toBeGreaterThanOrEqual(before + 60_000);
    expect(threshold).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

describe('IntegrationConnectionRepo token writes', () => {
  it('saves refreshed tokens only while the row still holds the refresh token that was sent', async () => {
    const { repo, queries } = buildRepo();
    const tokenExpiresAt = new Date();

    await repo.updateIfTokensMatch(
      'connection-1',
      { refreshToken: 'sent-refresh-token' },
      {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenExpiresAt,
        invalidatedAt: null,
      },
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toBe(
      'update "integration_connections" set "access_token" = $1, "refresh_token" = $2, "token_expires_at" = $3, "invalidated_at" = $4, "updated_at" = $5 where "id" = $6 and "refresh_token" = $7',
    );
    expect(queries[0].parameters).toEqual([
      'new-access-token',
      'new-refresh-token',
      tokenExpiresAt,
      null,
      expect.any(Date),
      'connection-1',
      'sent-refresh-token',
    ]);
  });

  it('retires a connection only while it still holds the expected access token', async () => {
    const { repo, queries } = buildRepo();

    await repo.invalidate('connection-1', { accessToken: 'used-access-token' });

    expect(queries[0].sql).toBe(
      'update "integration_connections" set "invalidated_at" = $1, "refresh_token" = $2, "token_expires_at" = $3, "updated_at" = $4 where "id" = $5 and "access_token" = $6',
    );
    expect(queries[0].parameters.slice(1)).toEqual([
      null,
      null,
      expect.any(Date),
      'connection-1',
      'used-access-token',
    ]);
  });

  it('retires a connection unconditionally when no token is expected', async () => {
    const { repo, queries } = buildRepo();

    await repo.invalidate('connection-1');

    expect(queries[0].sql).toBe(
      'update "integration_connections" set "invalidated_at" = $1, "refresh_token" = $2, "token_expires_at" = $3, "updated_at" = $4 where "id" = $5',
    );
  });
});
