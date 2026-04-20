import { Expression, ExpressionBuilder, sql, SqlBool } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { BaseProperty } from '@docmost/db/types/entity.types';
import { Condition, FilterNode } from './schema.zod';
import { PropertyKind, propertyKind, SYSTEM_COLUMN } from './kinds';
import {
  arrayCell,
  boolCell,
  dateCell,
  escapeIlike,
  numericCell,
  textCell,
} from './extractors';

export type PropertySchema = Map<
  string,
  Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>
>;

type Eb = ExpressionBuilder<DB, 'baseRows'>;

const TRUE = sql<SqlBool>`TRUE`;
const FALSE = sql<SqlBool>`FALSE`;

export function buildWhere(
  eb: Eb,
  node: FilterNode,
  schema: PropertySchema,
): Expression<SqlBool> {
  if ('children' in node) {
    if (node.children.length === 0) return TRUE;
    const built = node.children.map((c) => buildWhere(eb, c, schema));
    return node.op === 'and' ? eb.and(built) : eb.or(built);
  }
  return buildCondition(eb, node, schema);
}

function buildCondition(
  eb: Eb,
  cond: Condition,
  schema: PropertySchema,
): Expression<SqlBool> {
  const prop = schema.get(cond.propertyId);
  if (!prop) return FALSE;

  const sysCol = SYSTEM_COLUMN[prop.type];
  if (sysCol) return systemCondition(eb, sysCol, prop.type, cond);

  const kind = propertyKind(prop.type);
  if (!kind) return FALSE;

  switch (kind) {
    case PropertyKind.TEXT:
      return textCondition(eb, cond);
    case PropertyKind.NUMERIC:
      return numericCondition(eb, cond);
    case PropertyKind.DATE:
      return dateCondition(eb, cond);
    case PropertyKind.BOOL:
      return boolCondition(eb, cond);
    case PropertyKind.SELECT:
      return selectCondition(eb, cond);
    case PropertyKind.MULTI:
      return multiCondition(eb, cond);
    case PropertyKind.PERSON:
      return personCondition(eb, cond, prop);
    case PropertyKind.FILE:
      return arrayOfIdsCondition(eb, cond);
    case PropertyKind.PAGE:
      return pageCondition(eb, cond);
    default:
      return FALSE;
  }
}

// --- per-kind handlers ------------------------------------------------

function textCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  const expr = textCell(cond.propertyId);
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, '=', ''),
      ]);
    case 'isNotEmpty':
      return eb.and([
        eb(expr as any, 'is not', null),
        eb(expr as any, '!=', ''),
      ]);
    case 'eq':
      return val == null ? FALSE : eb(expr as any, '=', String(val));
    case 'neq':
      return val == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', String(val)),
          ]);
    case 'contains':
      return val == null
        ? FALSE
        : eb(expr as any, 'ilike', `%${escapeIlike(String(val))}%`);
    case 'ncontains':
      return val == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, 'not ilike', `%${escapeIlike(String(val))}%`),
          ]);
    case 'startsWith':
      return val == null
        ? FALSE
        : eb(expr as any, 'ilike', `${escapeIlike(String(val))}%`);
    case 'endsWith':
      return val == null
        ? FALSE
        : eb(expr as any, 'ilike', `%${escapeIlike(String(val))}`);
    default:
      return FALSE;
  }
}

function numericCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  const expr = numericCell(cond.propertyId);
  const raw = cond.value;
  const num = raw == null ? null : Number(raw);
  const bad = num == null || Number.isNaN(num);
  switch (cond.op) {
    case 'isEmpty':
      return eb(expr as any, 'is', null);
    case 'isNotEmpty':
      return eb(expr as any, 'is not', null);
    case 'eq':
      return bad ? FALSE : eb(expr as any, '=', num);
    case 'neq':
      return bad
        ? FALSE
        : eb.or([eb(expr as any, 'is', null), eb(expr as any, '!=', num)]);
    case 'gt':
      return bad ? FALSE : eb(expr as any, '>', num);
    case 'gte':
      return bad ? FALSE : eb(expr as any, '>=', num);
    case 'lt':
      return bad ? FALSE : eb(expr as any, '<', num);
    case 'lte':
      return bad ? FALSE : eb(expr as any, '<=', num);
    default:
      return FALSE;
  }
}

function dateCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  const expr = dateCell(cond.propertyId);
  const raw = cond.value;
  const bad = raw == null || raw === '';
  switch (cond.op) {
    case 'isEmpty':
      return eb(expr as any, 'is', null);
    case 'isNotEmpty':
      return eb(expr as any, 'is not', null);
    case 'eq':
      return bad ? FALSE : eb(expr as any, '=', String(raw));
    case 'neq':
      return bad
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', String(raw)),
          ]);
    case 'before':
      return bad ? FALSE : eb(expr as any, '<', String(raw));
    case 'after':
      return bad ? FALSE : eb(expr as any, '>', String(raw));
    case 'onOrBefore':
      return bad ? FALSE : eb(expr as any, '<=', String(raw));
    case 'onOrAfter':
      return bad ? FALSE : eb(expr as any, '>=', String(raw));
    default:
      return FALSE;
  }
}

function boolCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  const expr = boolCell(cond.propertyId);
  switch (cond.op) {
    case 'isEmpty':
      return eb(expr as any, 'is', null);
    case 'isNotEmpty':
      return eb(expr as any, 'is not', null);
    case 'eq':
      return cond.value == null
        ? FALSE
        : eb(expr as any, '=', Boolean(cond.value));
    case 'neq':
      return cond.value == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', Boolean(cond.value)),
          ]);
    default:
      return FALSE;
  }
}

function selectCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  // Cell stores a single option UUID as string. Use text extractor.
  const expr = textCell(cond.propertyId);
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, '=', ''),
      ]);
    case 'isNotEmpty':
      return eb.and([
        eb(expr as any, 'is not', null),
        eb(expr as any, '!=', ''),
      ]);
    case 'eq':
      return val == null ? FALSE : eb(expr as any, '=', String(val));
    case 'neq':
      return val == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', String(val)),
          ]);
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return FALSE;
      return eb(expr as any, 'in', arr);
    }
    case 'none': {
      const arr = asStringArray(val);
      if (arr.length === 0) return TRUE;
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, 'not in', arr),
      ]);
    }
    default:
      return FALSE;
  }
}

function multiCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  return arrayOfIdsCondition(eb, cond);
}

function personCondition(
  eb: Eb,
  cond: Condition,
  prop: Pick<BaseProperty, 'id' | 'type' | 'typeOptions'>,
): Expression<SqlBool> {
  // Person cells may be stored as a single uuid or an array of uuids depending
  // on the property's `allowMultiple` option. Normalise to array semantics via
  // `base_cell_array` when it's stored as an array, else text.
  const allowMultiple = !!(prop.typeOptions as any)?.allowMultiple;
  if (allowMultiple) return arrayOfIdsCondition(eb, cond);

  const expr = textCell(cond.propertyId);
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, '=', ''),
      ]);
    case 'isNotEmpty':
      return eb.and([
        eb(expr as any, 'is not', null),
        eb(expr as any, '!=', ''),
      ]);
    case 'eq':
      return val == null ? FALSE : eb(expr as any, '=', String(val));
    case 'neq':
      return val == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', String(val)),
          ]);
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return FALSE;
      return eb(expr as any, 'in', arr);
    }
    default:
      return FALSE;
  }
}

function pageCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  // Page cells store a single page uuid as text. Shape matches selectCondition.
  const expr = textCell(cond.propertyId);
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, '=', ''),
      ]);
    case 'isNotEmpty':
      return eb.and([
        eb(expr as any, 'is not', null),
        eb(expr as any, '!=', ''),
      ]);
    case 'eq':
      return val == null ? FALSE : eb(expr as any, '=', String(val));
    case 'neq':
      return val == null
        ? FALSE
        : eb.or([
            eb(expr as any, 'is', null),
            eb(expr as any, '!=', String(val)),
          ]);
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return FALSE;
      return eb(expr as any, 'in', arr);
    }
    case 'none': {
      const arr = asStringArray(val);
      if (arr.length === 0) return TRUE;
      return eb.or([
        eb(expr as any, 'is', null),
        eb(expr as any, 'not in', arr),
      ]);
    }
    default:
      return FALSE;
  }
}

function arrayOfIdsCondition(eb: Eb, cond: Condition): Expression<SqlBool> {
  const expr = arrayCell(cond.propertyId);
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return eb.or([
        eb(expr as any, 'is', null),
        sql<SqlBool>`jsonb_array_length(${expr}) = 0`,
      ]);
    case 'isNotEmpty':
      return eb.and([
        eb(expr as any, 'is not', null),
        sql<SqlBool>`jsonb_array_length(${expr}) > 0`,
      ]);
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return FALSE;
      return sql<SqlBool>`${expr} ?| ${arr}`;
    }
    case 'all': {
      const arr = asStringArray(val);
      if (arr.length === 0) return TRUE;
      // `::text::jsonb` because postgres.js auto-detects JSON-shaped strings
      // as jsonb and re-encodes them, producing a jsonb *string* instead of
      // an array. Without the text hop, the containment check never matches.
      return sql<SqlBool>`${expr} @> ${JSON.stringify(arr)}::text::jsonb`;
    }
    case 'none': {
      const arr = asStringArray(val);
      if (arr.length === 0) return TRUE;
      return eb.or([
        eb(expr as any, 'is', null),
        sql<SqlBool>`NOT (${expr} ?| ${arr})`,
      ]);
    }
    default:
      return FALSE;
  }
}

function systemCondition(
  eb: Eb,
  column: 'createdAt' | 'updatedAt' | 'lastUpdatedById',
  propertyType: string,
  cond: Condition,
): Expression<SqlBool> {
  const ref = eb.ref(column);
  const val = cond.value;

  // lastEditedBy — UUID column; behaves like select (uuid equality, in, isEmpty).
  if (propertyType === 'lastEditedBy') {
    switch (cond.op) {
      case 'isEmpty':
        return eb(ref, 'is', null);
      case 'isNotEmpty':
        return eb(ref, 'is not', null);
      case 'eq':
        return val == null ? FALSE : eb(ref, '=', String(val));
      case 'neq':
        return val == null
          ? FALSE
          : eb.or([eb(ref, 'is', null), eb(ref, '!=', String(val))]);
      case 'any': {
        const arr = asStringArray(val);
        if (arr.length === 0) return FALSE;
        return eb(ref, 'in', arr);
      }
      case 'none': {
        const arr = asStringArray(val);
        if (arr.length === 0) return TRUE;
        return eb.or([eb(ref, 'is', null), eb(ref, 'not in', arr)]);
      }
      default:
        return FALSE;
    }
  }

  // createdAt / updatedAt — timestamptz columns (NOT NULL).
  const bad = val == null || val === '';
  switch (cond.op) {
    case 'isEmpty':
      return FALSE;
    case 'isNotEmpty':
      return TRUE;
    case 'eq':
      return bad ? FALSE : eb(ref, '=', String(val));
    case 'neq':
      return bad ? FALSE : eb(ref, '!=', String(val));
    case 'before':
      return bad ? FALSE : eb(ref, '<', String(val));
    case 'after':
      return bad ? FALSE : eb(ref, '>', String(val));
    case 'onOrBefore':
      return bad ? FALSE : eb(ref, '<=', String(val));
    case 'onOrAfter':
      return bad ? FALSE : eb(ref, '>=', String(val));
    default:
      return FALSE;
  }
}

// --- utilities --------------------------------------------------------

function asStringArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter((v) => v != null).map(String);
  return [String(val)];
}

export { TRUE as TRUE_EXPR, FALSE as FALSE_EXPR };
