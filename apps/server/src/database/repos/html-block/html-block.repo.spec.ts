import {
  CamelCasePlugin,
  CompiledQuery,
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { HtmlBlockRepo } from './html-block.repo';

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
  return { repo: new HtmlBlockRepo(db as any), db, queries };
}

const row = (i: number) => ({
  id: `019a6000-0000-7000-8000-${String(i).padStart(12, '0')}`,
  workspaceId: 'ws-1',
  pageId: 'page-1',
  content: `<p>${i}</p>`,
  creatorId: 'user-1',
});

describe('HtmlBlockRepo insertMany', () => {
  it('inserts at most 1000 rows per statement', async () => {
    const { repo, queries } = buildRepo();

    await repo.insertMany(Array.from({ length: 2001 }, (_, i) => row(i)));

    expect(queries.map((query) => query.parameters.length)).toEqual([
      5000, 5000, 5,
    ]);
    expect(queries.every((query) => query.sql.startsWith('insert into "html_blocks"'))).toBe(
      true,
    );
  });

  it('runs the batches in one transaction it opens when no trx is given', async () => {
    const { repo, db, queries } = buildRepo();
    const transaction = jest.spyOn(db, 'transaction');
    const insertOutsideTransaction = jest.spyOn(db, 'insertInto');

    await repo.insertMany(Array.from({ length: 1001 }, (_, i) => row(i)));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertOutsideTransaction).not.toHaveBeenCalled();
    expect(queries).toHaveLength(2);
  });

  it('runs the batches in the transaction it is given', async () => {
    const { repo, db } = buildRepo();
    const transaction = jest.spyOn(db, 'transaction');
    const execute = jest.fn(async () => undefined);
    const trx = {
      insertInto: jest.fn((_table: string) => ({ values: () => ({ execute }) })),
    };

    await repo.insertMany(
      Array.from({ length: 1001 }, (_, i) => row(i)),
      trx as any,
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(trx.insertInto.mock.calls).toEqual([['htmlBlocks'], ['htmlBlocks']]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('runs no statement and opens no transaction for no rows', async () => {
    const { repo, db, queries } = buildRepo();
    const transaction = jest.spyOn(db, 'transaction');

    await repo.insertMany([]);

    expect(queries).toEqual([]);
    expect(transaction).not.toHaveBeenCalled();
  });
});
