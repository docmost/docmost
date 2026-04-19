import { BasePropertyType, BasePropertyTypeValue } from '../base.schemas';
import { ColumnSpec } from './query-cache.types';
import type { BaseProperty } from '@docmost/db/types/entity.types';

export const SYSTEM_COLUMNS: ColumnSpec[] = [
  { column: 'id', ddlType: 'VARCHAR', indexable: false },
  { column: 'position', ddlType: 'VARCHAR', indexable: true },
  { column: 'created_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'updated_at', ddlType: 'TIMESTAMPTZ', indexable: true },
  { column: 'last_updated_by_id', ddlType: 'VARCHAR', indexable: true },
  { column: 'deleted_at', ddlType: 'TIMESTAMPTZ', indexable: false },
  { column: 'search_text', ddlType: 'VARCHAR', indexable: false },
];

type PropertyLike = Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>;

export function buildColumnSpecs(properties: PropertyLike[]): ColumnSpec[] {
  const out: ColumnSpec[] = [...SYSTEM_COLUMNS];
  for (const prop of properties) {
    const spec = buildUserColumn(prop);
    if (spec) out.push(spec);
  }
  return out;
}

function buildUserColumn(prop: PropertyLike): ColumnSpec | null {
  const t = prop.type as BasePropertyTypeValue;
  switch (t) {
    case BasePropertyType.TEXT:
    case BasePropertyType.URL:
    case BasePropertyType.EMAIL:
      return { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    case BasePropertyType.NUMBER:
      return { column: prop.id, ddlType: 'DOUBLE', indexable: true, property: prop };
    case BasePropertyType.DATE:
      return { column: prop.id, ddlType: 'TIMESTAMPTZ', indexable: true, property: prop };
    case BasePropertyType.CHECKBOX:
      return { column: prop.id, ddlType: 'BOOLEAN', indexable: true, property: prop };
    case BasePropertyType.SELECT:
    case BasePropertyType.STATUS:
      return { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    case BasePropertyType.MULTI_SELECT:
    case BasePropertyType.FILE:
      return { column: prop.id, ddlType: 'JSON', indexable: false, property: prop };
    case BasePropertyType.PERSON: {
      const allowMultiple = !!(prop.typeOptions as any)?.allowMultiple;
      return allowMultiple
        ? { column: prop.id, ddlType: 'JSON', indexable: false, property: prop }
        : { column: prop.id, ddlType: 'VARCHAR', indexable: true, property: prop };
    }
    // System types are modelled as system columns on base_rows — do not add
    // a per-property column for them. They're already in SYSTEM_COLUMNS.
    case BasePropertyType.CREATED_AT:
    case BasePropertyType.LAST_EDITED_AT:
    case BasePropertyType.LAST_EDITED_BY:
      return null;
    default:
      return null;
  }
}
