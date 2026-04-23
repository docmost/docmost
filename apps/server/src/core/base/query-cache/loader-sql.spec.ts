import { buildLoaderSql } from './loader-sql';
import { ColumnSpec } from './query-cache.types';
import { BasePropertyType } from '../base.schemas';

const BASE_ID = '019c69a3-dd47-7014-8b87-ec8f1675aaaa';
const WORKSPACE_ID = '019c69a3-dd47-7014-8b87-ec8f1675bbbb';

const sys: ColumnSpec[] = [
  { column: 'id', ddlType: 'VARCHAR', indexable: false },
  { column: 'base_id', ddlType: 'VARCHAR', indexable: false },
  { column: 'workspace_id', ddlType: 'VARCHAR', indexable: false },
  { column: 'creator_id', ddlType: 'VARCHAR', indexable: false },
  { column: 'position', ddlType: 'VARCHAR', indexable: true },
  { column: 'created_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'updated_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'last_updated_by_id', ddlType: 'VARCHAR', indexable: true },
  { column: 'deleted_at', ddlType: 'TIMESTAMPTZ', indexable: false },
  { column: 'search_text', ddlType: 'VARCHAR', indexable: false },
];

const makeProp = (
  id: string,
  type: (typeof BasePropertyType)[keyof typeof BasePropertyType],
): ColumnSpec['property'] => ({ id, type, typeOptions: null } as any);

describe('buildLoaderSql', () => {
  it('projects system columns verbatim from pg.base_rows', () => {
    const sql = buildLoaderSql(sys, BASE_ID, WORKSPACE_ID);
    expect(sql).toContain('CREATE TABLE rows AS');
    expect(sql).toContain("SELECT * FROM postgres_query('pg', $pgsql$");
    expect(sql).toContain('id::text AS id');
    expect(sql).toContain('base_id::text AS base_id');
    expect(sql).toContain('position');
    expect(sql).toContain('created_at');
    expect(sql).toContain("''::VARCHAR AS search_text");
    expect(sql).toContain('FROM base_rows');
    expect(sql).toContain(`WHERE base_id = '${BASE_ID}'::uuid`);
    expect(sql).toContain(`AND workspace_id = '${WORKSPACE_ID}'::uuid`);
    expect(sql).toContain('AND deleted_at IS NULL');
    expect(sql).toContain('$pgsql$)');
  });

  it('maps TEXT -> base_cell_text', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577aa', BasePropertyType.TEXT);
    const sql = buildLoaderSql(
      [
        ...sys,
        { column: prop!.id, ddlType: 'VARCHAR', indexable: true, property: prop },
      ],
      BASE_ID,
      WORKSPACE_ID,
    );
    expect(sql).toContain(
      `base_cell_text(cells, '019c69a3-dd47-7014-8b87-ec8f167577aa'::uuid) AS "019c69a3-dd47-7014-8b87-ec8f167577aa"`,
    );
  });

  it('maps NUMBER -> base_cell_numeric', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577bb', BasePropertyType.NUMBER);
    const sql = buildLoaderSql(
      [
        ...sys,
        { column: prop!.id, ddlType: 'DOUBLE', indexable: true, property: prop },
      ],
      BASE_ID,
      WORKSPACE_ID,
    );
    expect(sql).toContain(
      `base_cell_numeric(cells, '019c69a3-dd47-7014-8b87-ec8f167577bb'::uuid) AS "019c69a3-dd47-7014-8b87-ec8f167577bb"`,
    );
  });

  it('maps DATE -> base_cell_timestamptz', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577cc', BasePropertyType.DATE);
    const sql = buildLoaderSql(
      [
        ...sys,
        { column: prop!.id, ddlType: 'TIMESTAMPTZ', indexable: true, property: prop },
      ],
      BASE_ID,
      WORKSPACE_ID,
    );
    expect(sql).toContain(
      `base_cell_timestamptz(cells, '019c69a3-dd47-7014-8b87-ec8f167577cc'::uuid) AS "019c69a3-dd47-7014-8b87-ec8f167577cc"`,
    );
  });

  it('maps CHECKBOX -> base_cell_bool', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577dd', BasePropertyType.CHECKBOX);
    const sql = buildLoaderSql(
      [
        ...sys,
        { column: prop!.id, ddlType: 'BOOLEAN', indexable: true, property: prop },
      ],
      BASE_ID,
      WORKSPACE_ID,
    );
    expect(sql).toContain(
      `base_cell_bool(cells, '019c69a3-dd47-7014-8b87-ec8f167577dd'::uuid) AS "019c69a3-dd47-7014-8b87-ec8f167577dd"`,
    );
  });

  it('maps MULTI_SELECT (JSON) -> raw jsonb cast to text', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577ee', BasePropertyType.MULTI_SELECT);
    const sql = buildLoaderSql(
      [
        ...sys,
        { column: prop!.id, ddlType: 'JSON', indexable: false, property: prop },
      ],
      BASE_ID,
      WORKSPACE_ID,
    );
    expect(sql).toContain(
      `(cells -> '019c69a3-dd47-7014-8b87-ec8f167577ee')::text AS "019c69a3-dd47-7014-8b87-ec8f167577ee"`,
    );
  });

  it('rejects invalid column names (defense-in-depth against quoting bugs)', () => {
    const bad: ColumnSpec = {
      column: 'pwned"; DROP TABLE rows; --',
      ddlType: 'VARCHAR',
      indexable: false,
    };
    expect(() => buildLoaderSql([bad], BASE_ID, WORKSPACE_ID)).toThrow(
      /invalid column name/i,
    );
  });

  it('rejects non-UUID property ids', () => {
    const badProp = { id: 'not-a-uuid', type: BasePropertyType.TEXT, typeOptions: null } as any;
    expect(() =>
      buildLoaderSql(
        [
          { column: 'some-uuid-col', ddlType: 'VARCHAR', indexable: true, property: badProp },
        ],
        BASE_ID,
        WORKSPACE_ID,
      ),
    ).toThrow(/invalid property uuid/i);
  });

  it('rejects invalid base id', () => {
    expect(() => buildLoaderSql(sys, 'not-a-uuid', WORKSPACE_ID)).toThrow(
      /invalid base id/i,
    );
  });

  it('rejects invalid workspace id', () => {
    expect(() => buildLoaderSql(sys, BASE_ID, 'not-a-uuid')).toThrow(
      /invalid workspace id/i,
    );
  });

  it('produces deterministic column order across invocations', () => {
    const a = buildLoaderSql(sys, BASE_ID, WORKSPACE_ID);
    const b = buildLoaderSql(sys, BASE_ID, WORKSPACE_ID);
    expect(a).toEqual(b);
  });
});
