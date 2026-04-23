import { buildColumnSpecs } from './column-types';
import { buildDuckDbListQuery } from './duckdb-query-builder';
import { BasePropertyType } from '../base.schemas';

const numericProp = {
  id: '00000000-0000-0000-0000-000000000001',
  type: BasePropertyType.NUMBER,
  typeOptions: {},
} as any;
const textProp = {
  id: '00000000-0000-0000-0000-000000000002',
  type: BasePropertyType.TEXT,
  typeOptions: {},
} as any;

const columns = buildColumnSpecs([numericProp, textProp]);

describe('buildDuckDbListQuery', () => {
  it('renders no-filter, no-sort, no-search as live-rows-paginated-by-position', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/FROM rows/);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY position ASC, id ASC/);
    expect(sql).toMatch(/LIMIT 101/);
    expect(params).toEqual([]);
  });

  it('renders numeric gt filter with parameterized value', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'and',
        children: [{ propertyId: numericProp.id, op: 'gt', value: 42 }],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(new RegExp(`"${numericProp.id}" > \\?`));
    expect(params).toContain(42);
  });

  it('renders text contains with ILIKE and escaped wildcards', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'and',
        children: [{ propertyId: textProp.id, op: 'contains', value: 'a_b%c' }],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/ILIKE \?/);
    expect(params).toContain('%a\\_b\\%c%');
  });

  it('renders sort with sentinel wrapping and cursor keyset', () => {
    const { sql } = buildDuckDbListQuery({
      columns,
      sorts: [{ propertyId: numericProp.id, direction: 'asc' }],
      pagination: {
        limit: 50,
        afterKeys: { s0: 10, position: 'A0', id: '00000000-0000-0000-0000-0000000000aa' },
      },
    });
    expect(sql).toMatch(/COALESCE\("[0-9a-f-]+", '?[Ii]nfinity'?::[A-Z]+\) AS s0/);
    expect(sql).toMatch(/ORDER BY s0 ASC, position ASC, id ASC/);
    // keyset OR-chain
    expect(sql).toMatch(/s0 > \?/);
  });

  it('renders search in trgm mode as ILIKE on search_text', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      search: { mode: 'trgm', query: 'hello' },
      pagination: { limit: 10 },
    });
    expect(sql).toMatch(/search_text ILIKE \?/);
    expect(params).toContain('%hello%');
  });

  it('renders multi-select any filter with json_contains and to_json binding', () => {
    const multiProp = {
      id: '00000000-0000-0000-0000-000000000010',
      type: BasePropertyType.MULTI_SELECT,
      typeOptions: {},
    } as any;
    const cols = buildColumnSpecs([multiProp]);
    const choiceA = 'choice-uuid-aaa';
    const choiceB = 'choice-uuid-bbb';
    const { sql, params } = buildDuckDbListQuery({
      columns: cols,
      filter: {
        op: 'and',
        children: [{ propertyId: multiProp.id, op: 'any', value: [choiceA, choiceB] }],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/json_contains\("[0-9a-f-]+", to_json\(\?\)\)/);
    expect(sql).not.toMatch(/json_array_contains/);
    expect(params).toContain(choiceA);
    expect(params).toContain(choiceB);
  });

  it('renders nested AND/OR groups with correct parentheses', () => {
    const { sql } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'or',
        children: [
          { op: 'and', children: [{ propertyId: numericProp.id, op: 'gt', value: 1 }] },
          { op: 'and', children: [{ propertyId: textProp.id, op: 'eq', value: 'x' }] },
        ],
      },
      pagination: { limit: 100 },
    });
    expect(sql).toMatch(/\(\(.+\) OR \(.+\)\)/);
  });

  it('handles empty filter group without emitting WHERE on it', () => {
    const { sql, params } = buildDuckDbListQuery({
      columns,
      filter: { op: 'and', children: [] },
      pagination: { limit: 100 },
    });
    // either WHERE clause elided entirely, or group becomes TRUE
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(params).toEqual([]);
  });

  it('renders multi-sort keyset with s0, s1, position, id chain', () => {
    const { sql } = buildDuckDbListQuery({
      columns,
      sorts: [
        { propertyId: numericProp.id, direction: 'asc' },
        { propertyId: textProp.id, direction: 'desc' },
      ],
      pagination: {
        limit: 10,
        afterKeys: { s0: 10, s1: 'abc', position: 'A0', id: '00000000-0000-0000-0000-0000000000aa' },
      },
    });
    expect(sql).toMatch(/AS s0/);
    expect(sql).toMatch(/AS s1/);
    expect(sql).toMatch(/ORDER BY s0 ASC, s1 DESC, position ASC, id ASC/);
    expect(sql).toMatch(/s0 > \?/);
    expect(sql).toMatch(/s1 < \?/); // desc → less-than
  });

  it('renders text isEmpty as IS NULL OR = empty-string', () => {
    const { sql } = buildDuckDbListQuery({
      columns,
      filter: {
        op: 'and',
        children: [{ propertyId: textProp.id, op: 'isEmpty' }],
      },
      pagination: { limit: 10 },
    });
    expect(sql).toMatch(new RegExp(`"${textProp.id}" IS NULL`));
  });
});
