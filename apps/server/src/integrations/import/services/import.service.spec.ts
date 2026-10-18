jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (input: string) => input.toLowerCase().replace(/\s+/g, '-'),
}));

import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { ImportService } from './import.service';

// Kysely over a fake driver that returns no rows, enough to open a transaction.
function makeDb() {
  const connection = {
    executeQuery: async (_compiled: CompiledQuery) => ({ rows: [] }),
    streamQuery: async function* () {},
  };
  return new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [new CamelCasePlugin()],
  });
}

describe('ImportService.importPage', () => {
  it('inserts the imported page and diverts it in the same transaction', async () => {
    const pageRepo = {
      insertPage: jest.fn(async (page: any, _trx?: unknown) => ({
        ...page,
        id: 'page-1',
      })),
    };
    const pageApprovalService = {
      divertNewPages: jest.fn(async (ids: string[], _trx?: unknown) => ids),
    };
    const service = new ImportService(
      pageRepo as any,
      {} as any,
      makeDb() as any,
      {} as any,
      {} as any,
      pageApprovalService as any,
    );
    const file = Promise.resolve({
      filename: 'note.md',
      toBuffer: async () => Buffer.from('# Imported\n\nImported body text'),
    } as any);

    const page = await service.importPage(file, 'user-1', 'space-1', 'ws-1');

    expect(page.id).toBe('page-1');
    expect(pageRepo.insertPage.mock.calls[0][0]).toMatchObject({
      title: 'Imported',
      spaceId: 'space-1',
    });
    expect(JSON.stringify(pageRepo.insertPage.mock.calls[0][0].content)).toContain(
      'Imported body text',
    );
    const trx = pageRepo.insertPage.mock.calls[0][1];
    expect(trx).toBeDefined();
    expect(pageApprovalService.divertNewPages).toHaveBeenCalledWith(
      ['page-1'],
      trx,
    );
  });
});
