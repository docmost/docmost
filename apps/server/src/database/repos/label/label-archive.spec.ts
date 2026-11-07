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
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { LabelRepo, LabelType } from './label.repo';

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
    {} as any,
    {} as any,
  );
  const repo = new LabelRepo(db as any, spaceMemberRepo);
  return { repo, queries };
}

const pagination = Object.assign(new PaginationOptions(), { limit: 20 });
const archivedFilter = '"spaces"."archived_at" is null';

describe('LabelRepo archived spaces', () => {
  it('leaves archived spaces out of label suggestions', async () => {
    const { repo, queries } = buildRepo();

    await repo.findLabels('ws-1', 'user-1', LabelType.PAGE, pagination);

    expect(queries[0].sql).toContain(archivedFilter);
  });

  it('leaves archived spaces out of label pages across spaces', async () => {
    const { repo, queries } = buildRepo();

    await repo.findPagesByLabelId('label-1', 'user-1', { pagination });

    expect(queries[0].sql).toContain(archivedFilter);
  });

  it('keeps label pages inside a space unfiltered', async () => {
    const { repo, queries } = buildRepo();

    await repo.findPagesByLabelId('label-1', 'user-1', {
      pagination,
      spaceId: 'space-1',
    });

    expect(queries[0].sql).not.toContain('archived_at');
  });

  it('leaves archived spaces out of label counts across spaces', async () => {
    const { repo, queries } = buildRepo();

    await repo.getLabelPageCountForUser('label-1', 'user-1');

    expect(queries[0].sql).toContain(archivedFilter);
  });
});
