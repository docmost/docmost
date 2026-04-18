import { RawBuilder, sql } from 'kysely';
import { BaseProperty } from '@docmost/db/types/entity.types';
import { SortSpec } from './schema.zod';
import { PropertyKind, SYSTEM_COLUMN, propertyKind } from './kinds';
import {
  boolCell,
  dateCell,
  numericCell,
  textCell,
} from './extractors';
import { PropertySchema } from './predicate';

/*
 * Builds sort expressions with sentinel wrapping so NULLs compare
 * deterministically at the end of the sort order. This avoids the
 * `__null__` string sentinel bug in the old cursor encoder: because the
 * sort expression never returns NULL, the cursor simply stores the
 * extracted value and keyset comparisons work natively.
 */

export type SortBuild = {
  key: string;                // alias used in cursor (s0, s1, ...)
  expression: RawBuilder<any>; // COALESCE-wrapped expression with sentinel
  direction: 'asc' | 'desc';
  valueType: 'numeric' | 'date' | 'text' | 'bool';
};

export type TailKey = 'position' | 'id';

export const CURSOR_TAIL_KEYS: TailKey[] = ['position', 'id'];

export function buildSorts(
  sorts: SortSpec[],
  schema: PropertySchema,
): SortBuild[] {
  const out: SortBuild[] = [];
  for (let i = 0; i < sorts.length; i++) {
    const s = sorts[i];
    const prop = schema.get(s.propertyId);
    if (!prop) continue;

    const key = `s${i}`;
    const dir = s.direction;

    const sysCol = SYSTEM_COLUMN[prop.type];
    if (sysCol) {
      out.push({
        key,
        expression: sql`${sql.ref(sysCol)}`,
        direction: dir,
        valueType: prop.type === 'lastEditedBy' ? 'text' : 'date',
      });
      continue;
    }

    const kind = propertyKind(prop.type);
    if (!kind) continue;

    out.push(wrapWithSentinel(s.propertyId, kind, dir, key));
  }
  return out;
}

function wrapWithSentinel(
  propertyId: string,
  kind: Exclude<ReturnType<typeof propertyKind>, null>,
  direction: 'asc' | 'desc',
  key: string,
): SortBuild {
  if (kind === PropertyKind.NUMERIC) {
    const sentinel =
      direction === 'asc'
        ? sql`'Infinity'::numeric`
        : sql`'-Infinity'::numeric`;
    return {
      key,
      expression: sql`COALESCE(${numericCell(propertyId)}, ${sentinel})`,
      direction,
      valueType: 'numeric',
    };
  }
  if (kind === PropertyKind.DATE) {
    const sentinel =
      direction === 'asc'
        ? sql`'infinity'::timestamptz`
        : sql`'-infinity'::timestamptz`;
    return {
      key,
      expression: sql`COALESCE(${dateCell(propertyId)}, ${sentinel})`,
      direction,
      valueType: 'date',
    };
  }
  if (kind === PropertyKind.BOOL) {
    // false < true. ASC NULLS LAST => null → true; DESC NULLS LAST => null → false.
    const sentinel = direction === 'asc' ? sql`TRUE` : sql`FALSE`;
    return {
      key,
      expression: sql`COALESCE(${boolCell(propertyId)}, ${sentinel})`,
      direction,
      valueType: 'bool',
    };
  }
  // TEXT / SELECT / MULTI / PERSON / FILE — sort by raw extracted text.
  const sentinel = direction === 'asc' ? sql`chr(1114111)` : sql`''`;
  return {
    key,
    expression: sql`COALESCE(${textCell(propertyId)}, ${sentinel})`,
    direction,
    valueType: 'text',
  };
}
