import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { ShareService } from './share.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000050';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000051';

describe('ShareService.getShareForPage', () => {
  it('only inherits a share from ancestors in the same space', async () => {
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
    const service = new ShareService(
      {} as any,
      {} as any,
      {} as any,
      db as any,
      {} as any,
      {} as any,
    );

    await service.getShareForPage(PAGE_ID, WORKSPACE_ID);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('"p"."space_id" = "ph"."page_space_id"');
  });
});
