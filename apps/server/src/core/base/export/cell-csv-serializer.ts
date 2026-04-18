import { BasePropertyType, BasePropertyTypeValue } from '../base.schemas';

export type CellCsvContext = {
  userNames?: Map<string, string>;
};

type PropertyLike = {
  id: string;
  type: BasePropertyTypeValue | string;
  typeOptions?: unknown;
};

function resolveChoiceName(typeOptions: unknown, id: unknown): string {
  if (!typeOptions || typeof typeOptions !== 'object') return '';
  const choices = (typeOptions as any).choices;
  if (!Array.isArray(choices)) return '';
  const match = choices.find((c: any) => c?.id === id);
  return typeof match?.name === 'string' ? match.name : '';
}

function resolveUser(id: unknown, ctx: CellCsvContext): string {
  if (typeof id !== 'string') return '';
  return ctx.userNames?.get(id) ?? '';
}

export function serializeCellForCsv(
  property: PropertyLike,
  value: unknown,
  ctx: CellCsvContext,
): string {
  if (value === null || value === undefined) return '';

  switch (property.type) {
    case BasePropertyType.TEXT:
    case BasePropertyType.URL:
    case BasePropertyType.EMAIL:
      return String(value);

    case BasePropertyType.NUMBER:
      return typeof value === 'number' ? String(value) : String(value ?? '');

    case BasePropertyType.CHECKBOX:
      return value === true ? 'true' : 'false';

    case BasePropertyType.DATE:
    case BasePropertyType.CREATED_AT:
    case BasePropertyType.LAST_EDITED_AT:
      if (value instanceof Date) return value.toISOString();
      return String(value);

    case BasePropertyType.SELECT:
    case BasePropertyType.STATUS:
      return resolveChoiceName(property.typeOptions, value);

    case BasePropertyType.MULTI_SELECT:
      if (!Array.isArray(value)) return '';
      return value
        .map((v) => resolveChoiceName(property.typeOptions, v))
        .filter((s) => s.length > 0)
        .join('; ');

    case BasePropertyType.PERSON: {
      const ids = Array.isArray(value) ? value : [value];
      return ids
        .map((id) => resolveUser(id, ctx))
        .filter((s) => s.length > 0)
        .join('; ');
    }

    case BasePropertyType.FILE:
      if (!Array.isArray(value)) return '';
      return value
        .map((f: any) =>
          f && typeof f === 'object' && typeof f.fileName === 'string'
            ? f.fileName
            : '',
        )
        .filter((s) => s.length > 0)
        .join('; ');

    case BasePropertyType.LAST_EDITED_BY:
      return resolveUser(value, ctx);

    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
