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
});
