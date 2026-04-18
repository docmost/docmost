import { BasePropertyType } from '../base.schemas';

export const PropertyKind = {
  TEXT: 'text',
  NUMERIC: 'numeric',
  DATE: 'date',
  BOOL: 'bool',
  SELECT: 'select',
  MULTI: 'multi',
  PERSON: 'person',
  FILE: 'file',
  SYS_USER: 'sys_user',
} as const;

export type PropertyKindValue = (typeof PropertyKind)[keyof typeof PropertyKind];

export function propertyKind(type: string): PropertyKindValue | null {
  switch (type) {
    case BasePropertyType.TEXT:
    case BasePropertyType.URL:
    case BasePropertyType.EMAIL:
      return PropertyKind.TEXT;
    case BasePropertyType.NUMBER:
      return PropertyKind.NUMERIC;
    case BasePropertyType.DATE:
    case BasePropertyType.CREATED_AT:
    case BasePropertyType.LAST_EDITED_AT:
      return PropertyKind.DATE;
    case BasePropertyType.CHECKBOX:
      return PropertyKind.BOOL;
    case BasePropertyType.SELECT:
    case BasePropertyType.STATUS:
      return PropertyKind.SELECT;
    case BasePropertyType.MULTI_SELECT:
      return PropertyKind.MULTI;
    case BasePropertyType.PERSON:
      return PropertyKind.PERSON;
    case BasePropertyType.FILE:
      return PropertyKind.FILE;
    case BasePropertyType.LAST_EDITED_BY:
      return PropertyKind.SYS_USER;
    default:
      return null;
  }
}

// System property type → camelCase column name on `base_rows`.
// Kysely camel-case plugin maps to snake_case in SQL.
export const SYSTEM_COLUMN: Record<string, 'createdAt' | 'updatedAt' | 'lastUpdatedById'> = {
  [BasePropertyType.CREATED_AT]: 'createdAt',
  [BasePropertyType.LAST_EDITED_AT]: 'updatedAt',
  [BasePropertyType.LAST_EDITED_BY]: 'lastUpdatedById',
};

export function isSystemType(type: string): boolean {
  return type in SYSTEM_COLUMN;
}
