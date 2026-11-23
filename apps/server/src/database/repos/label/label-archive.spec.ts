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
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { QueryLabelPagesDto } from '../../../core/label/dto/query-label-pages.dto';

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
  const repo = new LabelRepo(db as any, spaceMemberRepo, new PagePermissionRepo(db as any, null, null));
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

describe('Pages by label block', () => {
  const filters = Object.assign(new QueryLabelPagesDto(), {
    labels: ['guide', 'runbook'],
    scope: 'workspace',
  });

  it.each([
    ['title', 'updated_at'],
    ['updatedAt', 'updated_at'],
    ['createdAt', 'created_at'],
  ] as const)('selects the row metadata for %s sorting', async (sortBy, date) => {
    const { repo, queries } = buildRepo();
    await repo.queryPages('workspace', 'viewer', { ...filters, sortBy });
    const [projection] = queries[0].sql.split(' from "pages"');
    expect(projection).toContain(`"pages"."${date}"`);
    expect(projection).toContain('"pages"."is_base"');
    expect(projection).toContain('"spaces"."archived_at" as "space_archived_at"');
  });

  it('applies inherited restrictions, membership and exclusions before sorting and limiting', async () => {
    const { repo, queries } = buildRepo();
    await repo.queryPages('workspace', 'viewer', {
      ...filters,
      match: 'all',
      excludeLabels: ['draft'],
      limit: 1,
    });
    const { sql, parameters } = queries[0];
    expect(sql).toContain('with recursive ancestors');
    expect(sql).toContain('"space_members"');
    expect(sql).toContain(archivedFilter);
    expect(sql).toContain('having count');
    expect(sql).toContain('not in');
    expect(sql.indexOf('with recursive ancestors')).toBeLessThan(
      sql.indexOf('order by'),
    );
    expect(parameters).toEqual(
      expect.arrayContaining([
        'workspace',
        'viewer',
        'draft',
        'guide',
        'runbook',
      ]),
    );
    expect(parameters[parameters.length - 1]).toBe(1);
  });

  it('returns no results for an empty inclusion or unresolved scope', async () => {
    const { repo, queries } = buildRepo();
    for (const options of [
      { labels: [] },
      { scope: 'spaces' as const, spaceIds: [] },
      { scope: 'workspace' as const, spaceIds: ['a-space'] },
      { scope: 'current' as const },
    ]) {
      expect(
        await repo.queryPages('workspace', 'viewer', {
          ...filters,
          ...options,
        }),
      ).toEqual({ items: [] });
    }
    expect(queries).toHaveLength(0);
  });
});
