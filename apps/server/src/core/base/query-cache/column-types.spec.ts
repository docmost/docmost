import { BasePropertyType } from '../base.schemas';
import { buildColumnSpecs, SYSTEM_COLUMNS } from './column-types';

const p = (type: string, extra: Record<string, unknown> = {}) => ({
  id: `prop-${type}`,
  type,
  typeOptions: extra,
}) as any;

describe('buildColumnSpecs', () => {
  it('includes the fixed system columns first', () => {
    const specs = buildColumnSpecs([]);
    expect(specs.map((s) => s.column)).toEqual(SYSTEM_COLUMNS.map((s) => s.column));
  });

  it('maps text / url / email to VARCHAR indexable', () => {
    for (const t of [BasePropertyType.TEXT, BasePropertyType.URL, BasePropertyType.EMAIL]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('VARCHAR');
      expect(user.indexable).toBe(true);
    }
  });

  it('maps number to DOUBLE indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.NUMBER)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('DOUBLE');
    expect(user.indexable).toBe(true);
  });

  it('maps date to TIMESTAMPTZ indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.DATE)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('TIMESTAMPTZ');
    expect(user.indexable).toBe(true);
  });

  it('maps checkbox to BOOLEAN indexable', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.CHECKBOX)]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('BOOLEAN');
  });

  it('maps select / status to VARCHAR indexable', () => {
    for (const t of [BasePropertyType.SELECT, BasePropertyType.STATUS]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('VARCHAR');
      expect(user.indexable).toBe(true);
    }
  });

  it('maps multiSelect / file / multi-person to JSON non-indexable', () => {
    for (const t of [BasePropertyType.MULTI_SELECT, BasePropertyType.FILE]) {
      const specs = buildColumnSpecs([p(t)]);
      const user = specs[specs.length - 1];
      expect(user.ddlType).toBe('JSON');
      expect(user.indexable).toBe(false);
    }
    const specs = buildColumnSpecs([p(BasePropertyType.PERSON, { allowMultiple: true })]);
    expect(specs[specs.length - 1].ddlType).toBe('JSON');
  });

  it('maps single-person to VARCHAR indexable when allowMultiple=false', () => {
    const specs = buildColumnSpecs([p(BasePropertyType.PERSON, { allowMultiple: false })]);
    const user = specs[specs.length - 1];
    expect(user.ddlType).toBe('VARCHAR');
    expect(user.indexable).toBe(true);
  });

  it('skips unknown property types', () => {
    const specs = buildColumnSpecs([p('unknown-type-x')]);
    expect(specs.length).toBe(SYSTEM_COLUMNS.length);
  });
});
