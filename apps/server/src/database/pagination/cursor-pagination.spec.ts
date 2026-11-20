import { BadRequestException } from '@nestjs/common';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import {
  defaultDecodeCursor,
  defaultEncodeCursor,
  executeWithCursorPagination,
} from './cursor-pagination';

const FIELDS = ['position', 'id'] as any;
const encode = (text: string) =>
  Buffer.from(text, 'utf8').toString('base64url');

describe('defaultDecodeCursor', () => {
  it('reads back what defaultEncodeCursor wrote', () => {
    const cursor = defaultEncodeCursor([
      ['position', 'a00001'],
      ['id', 'x'],
    ] as any);
    expect(defaultDecodeCursor(cursor, FIELDS)).toEqual({
      position: 'a00001',
      id: 'x',
    });
  });

  it.each([
    ['a field is missing', encode('position=a00001')],
    ['a field is extra', encode('position=a00001&id=x&more=1')],
    ['a field has another name', encode('position=a00001&other=x')],
    ['the fields are in another order', encode('id=x&position=a00001')],
    ['the text is not a cursor', 'not-a-cursor'],
    ['the text is empty', ''],
  ])('refuses a cursor when %s', (_label, cursor) => {
    expect(() => defaultDecodeCursor(cursor, FIELDS)).toThrow(
      new BadRequestException('Invalid cursor'),
    );
  });
});

describe('backwards cursor pagination metadata', () => {
  async function backwards(rows: number[], before: number) {
    // The database returns descending rows for a beforeCursor request. Keep the
    // pagination implementation real and stub only this external query result.
    const driver = new DummyDriver();
    const connection = await driver.acquireConnection();
    jest.spyOn(connection, 'executeQuery').mockResolvedValue({
      rows: rows.map((id) => ({ id: String(id), position: `a${id}` })),
    });
    jest.spyOn(driver, 'acquireConnection').mockResolvedValue(connection);
    const db = new Kysely<any>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => driver,
        createIntrospector: (d) => new PostgresIntrospector(d),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
    });
    try {
      return await executeWithCursorPagination(
        db.selectFrom('rows').selectAll(),
        {
          perPage: 2,
          beforeCursor: defaultEncodeCursor([
            ['position', `a${before}`],
            ['id', String(before)],
          ] as any),
          fields: [
            { expression: 'position', direction: 'asc' },
            { expression: 'id', direction: 'asc' },
          ],
          parseCursor: (cursor) => cursor,
        },
      );
    } finally {
      await db.destroy();
    }
  }

  it('offers both directions when another earlier page exists', async () => {
    const result = await backwards([4, 3, 2], 5);
    expect(result.items.map((row) => row.id)).toEqual(['3', '4']);
    expect(result.meta).toMatchObject({ hasPrevPage: true, hasNextPage: true });
    expect(defaultDecodeCursor(result.meta.prevCursor!, FIELDS)).toEqual({
      position: 'a3',
      id: '3',
    });
    expect(defaultDecodeCursor(result.meta.nextCursor!, FIELDS)).toEqual({
      position: 'a4',
      id: '4',
    });
  });

  it('offers a forward cursor after returning to the first page', async () => {
    const result = await backwards([2, 1], 3);
    expect(result.items.map((row) => row.id)).toEqual(['1', '2']);
    expect(result.meta).toMatchObject({
      hasPrevPage: false,
      hasNextPage: true,
      prevCursor: null,
    });
    expect(defaultDecodeCursor(result.meta.nextCursor!, FIELDS)).toEqual({
      position: 'a2',
      id: '2',
    });
  });
});
