import { buildLoaderSql } from './loader-sql';
import { ColumnSpec } from './query-cache.types';
import { BasePropertyType } from '../base.schemas';

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
    const sql = buildLoaderSql(sys);
    expect(sql).toContain('CREATE TABLE rows AS');
    expect(sql).toContain('id::text AS id');
    expect(sql).toContain('base_id::text AS base_id');
    expect(sql).toContain('position');
    expect(sql).toContain('created_at');
    expect(sql).toContain("''::VARCHAR AS search_text");
    expect(sql).toContain('FROM pg.base_rows');
    expect(sql).toContain(
      'WHERE base_id = $1::uuid AND workspace_id = $2::uuid AND deleted_at IS NULL',
    );
  });

  it('maps TEXT -> base_cell_text', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577aa', BasePropertyType.TEXT);
    const sql = buildLoaderSql([
      ...sys,
      { column: prop!.id, ddlType: 'VARCHAR', indexable: true, property: prop },
    ]);
    expect(sql).toContain(
      `base_cell_text(cells, '019c69a3-dd47-7014-8b87-ec8f167577aa'::uuid) AS "019c69a3-dd47-7014-8b87-ec8f167577aa"`,
    );
  });

  it('maps NUMBER -> base_cell_numeric', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577bb', BasePropertyType.NUMBER);
    const sql = buildLoaderSql([
      ...sys,
      { column: prop!.id, ddlType: 'DOUBLE', indexable: true, property: prop },
    ]);
    expect(sql).toContain(`base_cell_numeric(cells, '019c69a3-dd47-7014-8b87-ec8f167577bb'::uuid)`);
  });

  it('maps DATE -> base_cell_timestamptz', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577cc', BasePropertyType.DATE);
    const sql = buildLoaderSql([
      ...sys,
      { column: prop!.id, ddlType: 'TIMESTAMPTZ', indexable: true, property: prop },
    ]);
    expect(sql).toContain(`base_cell_timestamptz(cells, '019c69a3-dd47-7014-8b87-ec8f167577cc'::uuid)`);
  });

  it('maps CHECKBOX -> base_cell_bool', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577dd', BasePropertyType.CHECKBOX);
    const sql = buildLoaderSql([
      ...sys,
      { column: prop!.id, ddlType: 'BOOLEAN', indexable: true, property: prop },
    ]);
    expect(sql).toContain(`base_cell_bool(cells, '019c69a3-dd47-7014-8b87-ec8f167577dd'::uuid)`);
  });

  it('maps MULTI_SELECT (JSON) -> raw jsonb cast to text', () => {
    const prop = makeProp('019c69a3-dd47-7014-8b87-ec8f167577ee', BasePropertyType.MULTI_SELECT);
    const sql = buildLoaderSql([
      ...sys,
      { column: prop!.id, ddlType: 'JSON', indexable: false, property: prop },
    ]);
    expect(sql).toContain(`(cells -> '019c69a3-dd47-7014-8b87-ec8f167577ee')::text`);
  });

  it('rejects invalid column names (defense-in-depth against quoting bugs)', () => {
    const bad: ColumnSpec = {
      column: 'pwned"; DROP TABLE rows; --',
      ddlType: 'VARCHAR',
      indexable: false,
    };
    expect(() => buildLoaderSql([bad])).toThrow(/invalid column name/i);
  });

  it('rejects non-UUID property ids', () => {
    const badProp = { id: 'not-a-uuid', type: BasePropertyType.TEXT, typeOptions: null } as any;
    expect(() =>
      buildLoaderSql([
        { column: 'some-uuid-col', ddlType: 'VARCHAR', indexable: true, property: badProp },
      ]),
    ).toThrow(/invalid property uuid/i);
  });

  it('produces deterministic column order across invocations', () => {
    const a = buildLoaderSql(sys);
    const b = buildLoaderSql(sys);
    expect(a).toEqual(b);
  });
});
