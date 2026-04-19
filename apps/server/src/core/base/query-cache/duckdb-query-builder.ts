import { BasePropertyType } from '../base.schemas';
import {
  Condition,
  FilterNode,
  SearchSpec,
  SortSpec,
} from '../engine/schema.zod';
import { escapeIlike } from '../engine/extractors';
import { PropertyKind, propertyKind } from '../engine/kinds';
import { ColumnSpec } from './query-cache.types';

export type AfterKeys = Record<string, unknown>;

export type DuckDbListQueryOpts = {
  columns: ColumnSpec[];
  filter?: FilterNode;
  sorts?: SortSpec[];
  search?: SearchSpec;
  pagination: { limit: number; afterKeys?: AfterKeys };
};

export type DuckDbListQuery = {
  sql: string;
  params: unknown[];
};

export class FtsNotSupportedInCache extends Error {
  constructor() {
    super('FTS search mode is not supported in the DuckDB query cache');
    this.name = 'FtsNotSupportedInCache';
  }
}

type ColumnIndex = {
  byId: Map<string, ColumnSpec>;
  userColumns: ColumnSpec[];
};

type SortBuild = {
  key: string;
  expression: string;
  direction: 'asc' | 'desc';
};

// System property type → DuckDB system column name. Mirrors
// engine/kinds.SYSTEM_COLUMN but in snake_case (DuckDB table uses
// snake_case columns; the engine relies on Kysely's camel-case plugin).
const SYSTEM_COLUMN_DUCK: Record<string, 'created_at' | 'updated_at' | 'last_updated_by_id'> = {
  [BasePropertyType.CREATED_AT]: 'created_at',
  [BasePropertyType.LAST_EDITED_AT]: 'updated_at',
  [BasePropertyType.LAST_EDITED_BY]: 'last_updated_by_id',
};

export function buildDuckDbListQuery(
  opts: DuckDbListQueryOpts,
): DuckDbListQuery {
  const index = indexColumns(opts.columns);
  const params: unknown[] = [];

  const whereClauses: string[] = ['deleted_at IS NULL'];

  if (opts.search) {
    whereClauses.push(buildSearch(opts.search, params));
  }

  if (opts.filter) {
    const filterSql = buildFilter(opts.filter, index, params);
    if (filterSql) whereClauses.push(filterSql);
  }

  const sortBuilds = buildSorts(opts.sorts ?? [], index);

  const selectParts: string[] = buildSelect(index, sortBuilds);

  if (opts.pagination.afterKeys) {
    whereClauses.push(
      buildKeyset(opts.pagination.afterKeys, sortBuilds, params),
    );
  }

  const orderByParts: string[] = [
    ...sortBuilds.map((s) => `${s.key} ${s.direction.toUpperCase()}`),
    'position ASC',
    'id ASC',
  ];

  const sql =
    `SELECT ${selectParts.join(', ')}` +
    ` FROM rows` +
    ` WHERE ${whereClauses.join(' AND ')}` +
    ` ORDER BY ${orderByParts.join(', ')}` +
    ` LIMIT ${opts.pagination.limit + 1}`;

  return { sql, params };
}

// --- select projection -------------------------------------------------

function buildSelect(index: ColumnIndex, sortBuilds: SortBuild[]): string[] {
  const parts: string[] = [
    'id',
    'base_id',
    'position',
    'creator_id',
    'last_updated_by_id',
    'workspace_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ];
  for (const col of index.userColumns) {
    parts.push(quoteIdent(col.column));
  }
  for (const sb of sortBuilds) {
    parts.push(`${sb.expression} AS ${sb.key}`);
  }
  return parts;
}

// --- filter ------------------------------------------------------------

function buildFilter(
  node: FilterNode,
  index: ColumnIndex,
  params: unknown[],
): string {
  if ('children' in node) {
    if (node.children.length === 0) return 'TRUE';
    const built = node.children
      .map((c) => buildFilter(c, index, params))
      .filter((s) => s.length > 0);
    if (built.length === 0) return 'TRUE';
    const joiner = node.op === 'and' ? ' AND ' : ' OR ';
    return `(${built.join(joiner)})`;
  }
  return buildCondition(node, index, params);
}

function buildCondition(
  cond: Condition,
  index: ColumnIndex,
  params: unknown[],
): string {
  const col = index.byId.get(cond.propertyId);
  if (!col) return 'FALSE';

  const propType = col.property?.type;
  if (propType && SYSTEM_COLUMN_DUCK[propType]) {
    return systemCondition(SYSTEM_COLUMN_DUCK[propType], cond, params);
  }

  const kind = propType ? propertyKind(propType) : null;
  if (!kind) return 'FALSE';

  const colRef = quoteIdent(col.column);

  switch (kind) {
    case PropertyKind.TEXT:
      return textCondition(colRef, cond, params);
    case PropertyKind.NUMERIC:
      return numericCondition(colRef, cond, params);
    case PropertyKind.DATE:
      return dateCondition(colRef, cond, params);
    case PropertyKind.BOOL:
      return boolCondition(colRef, cond, params);
    case PropertyKind.SELECT:
      return selectCondition(colRef, cond, params);
    case PropertyKind.MULTI:
      return arrayOfIdsCondition(colRef, cond, params);
    case PropertyKind.PERSON: {
      const allowMultiple = !!(col.property?.typeOptions as any)?.allowMultiple;
      return allowMultiple
        ? arrayOfIdsCondition(colRef, cond, params)
        : selectCondition(colRef, cond, params);
    }
    case PropertyKind.FILE:
      return arrayOfIdsCondition(colRef, cond, params);
    default:
      return 'FALSE';
  }
}

function textCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return `(${colRef} IS NULL OR ${colRef} = '')`;
    case 'isNotEmpty':
      return `(${colRef} IS NOT NULL AND ${colRef} != '')`;
    case 'eq':
      if (val == null) return 'FALSE';
      params.push(String(val));
      return `${colRef} = ?`;
    case 'neq':
      if (val == null) return 'FALSE';
      params.push(String(val));
      return `(${colRef} IS NULL OR ${colRef} != ?)`;
    case 'contains':
      if (val == null) return 'FALSE';
      params.push(`%${escapeIlike(String(val))}%`);
      return `${colRef} ILIKE ?`;
    case 'ncontains':
      if (val == null) return 'FALSE';
      params.push(`%${escapeIlike(String(val))}%`);
      return `(${colRef} IS NULL OR ${colRef} NOT ILIKE ?)`;
    case 'startsWith':
      if (val == null) return 'FALSE';
      params.push(`${escapeIlike(String(val))}%`);
      return `${colRef} ILIKE ?`;
    case 'endsWith':
      if (val == null) return 'FALSE';
      params.push(`%${escapeIlike(String(val))}`);
      return `${colRef} ILIKE ?`;
    default:
      return 'FALSE';
  }
}

function numericCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  const raw = cond.value;
  const num = raw == null ? null : Number(raw);
  const bad = num == null || Number.isNaN(num);
  switch (cond.op) {
    case 'isEmpty':
      return `${colRef} IS NULL`;
    case 'isNotEmpty':
      return `${colRef} IS NOT NULL`;
    case 'eq':
      if (bad) return 'FALSE';
      params.push(num);
      return `${colRef} = ?`;
    case 'neq':
      if (bad) return 'FALSE';
      params.push(num);
      return `(${colRef} IS NULL OR ${colRef} != ?)`;
    case 'gt':
      if (bad) return 'FALSE';
      params.push(num);
      return `${colRef} > ?`;
    case 'gte':
      if (bad) return 'FALSE';
      params.push(num);
      return `${colRef} >= ?`;
    case 'lt':
      if (bad) return 'FALSE';
      params.push(num);
      return `${colRef} < ?`;
    case 'lte':
      if (bad) return 'FALSE';
      params.push(num);
      return `${colRef} <= ?`;
    default:
      return 'FALSE';
  }
}

function dateCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  const raw = cond.value;
  const bad = raw == null || raw === '';
  switch (cond.op) {
    case 'isEmpty':
      return `${colRef} IS NULL`;
    case 'isNotEmpty':
      return `${colRef} IS NOT NULL`;
    case 'eq':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `${colRef} = ?`;
    case 'neq':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `(${colRef} IS NULL OR ${colRef} != ?)`;
    case 'before':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `${colRef} < ?`;
    case 'after':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `${colRef} > ?`;
    case 'onOrBefore':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `${colRef} <= ?`;
    case 'onOrAfter':
      if (bad) return 'FALSE';
      params.push(String(raw));
      return `${colRef} >= ?`;
    default:
      return 'FALSE';
  }
}

function boolCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  switch (cond.op) {
    case 'isEmpty':
      return `${colRef} IS NULL`;
    case 'isNotEmpty':
      return `${colRef} IS NOT NULL`;
    case 'eq':
      if (cond.value == null) return 'FALSE';
      params.push(Boolean(cond.value));
      return `${colRef} = ?`;
    case 'neq':
      if (cond.value == null) return 'FALSE';
      params.push(Boolean(cond.value));
      return `(${colRef} IS NULL OR ${colRef} != ?)`;
    default:
      return 'FALSE';
  }
}

function selectCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return `(${colRef} IS NULL OR ${colRef} = '')`;
    case 'isNotEmpty':
      return `(${colRef} IS NOT NULL AND ${colRef} != '')`;
    case 'eq':
      if (val == null) return 'FALSE';
      params.push(String(val));
      return `${colRef} = ?`;
    case 'neq':
      if (val == null) return 'FALSE';
      params.push(String(val));
      return `(${colRef} IS NULL OR ${colRef} != ?)`;
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return 'FALSE';
      const placeholders = arr.map(() => '?').join(', ');
      for (const v of arr) params.push(v);
      return `${colRef} IN (${placeholders})`;
    }
    case 'none': {
      const arr = asStringArray(val);
      if (arr.length === 0) return 'TRUE';
      const placeholders = arr.map(() => '?').join(', ');
      for (const v of arr) params.push(v);
      return `(${colRef} IS NULL OR ${colRef} NOT IN (${placeholders}))`;
    }
    default:
      return 'FALSE';
  }
}

function arrayOfIdsCondition(
  colRef: string,
  cond: Condition,
  params: unknown[],
): string {
  const val = cond.value;
  switch (cond.op) {
    case 'isEmpty':
      return `(${colRef} IS NULL OR json_array_length(${colRef}) = 0)`;
    case 'isNotEmpty':
      return `(${colRef} IS NOT NULL AND json_array_length(${colRef}) > 0)`;
    case 'any': {
      const arr = asStringArray(val);
      if (arr.length === 0) return 'FALSE';
      const legs = arr.map(() => jsonArrayContains(colRef, '?'));
      for (const v of arr) params.push(v);
      return `(${legs.join(' OR ')})`;
    }
    case 'all': {
      const arr = asStringArray(val);
      if (arr.length === 0) return 'TRUE';
      const legs = arr.map(() => jsonArrayContains(colRef, '?'));
      for (const v of arr) params.push(v);
      return `(${legs.join(' AND ')})`;
    }
    case 'none': {
      const arr = asStringArray(val);
      if (arr.length === 0) return 'TRUE';
      const legs = arr.map(() => jsonArrayContains(colRef, '?'));
      for (const v of arr) params.push(v);
      return `(${colRef} IS NULL OR NOT (${legs.join(' OR ')}))`;
    }
    default:
      return 'FALSE';
  }
}

function systemCondition(
  column: 'created_at' | 'updated_at' | 'last_updated_by_id',
  cond: Condition,
  params: unknown[],
): string {
  const val = cond.value;

  if (column === 'last_updated_by_id') {
    switch (cond.op) {
      case 'isEmpty':
        return `${column} IS NULL`;
      case 'isNotEmpty':
        return `${column} IS NOT NULL`;
      case 'eq':
        if (val == null) return 'FALSE';
        params.push(String(val));
        return `${column} = ?`;
      case 'neq':
        if (val == null) return 'FALSE';
        params.push(String(val));
        return `(${column} IS NULL OR ${column} != ?)`;
      case 'any': {
        const arr = asStringArray(val);
        if (arr.length === 0) return 'FALSE';
        const placeholders = arr.map(() => '?').join(', ');
        for (const v of arr) params.push(v);
        return `${column} IN (${placeholders})`;
      }
      case 'none': {
        const arr = asStringArray(val);
        if (arr.length === 0) return 'TRUE';
        const placeholders = arr.map(() => '?').join(', ');
        for (const v of arr) params.push(v);
        return `(${column} IS NULL OR ${column} NOT IN (${placeholders}))`;
      }
      default:
        return 'FALSE';
    }
  }

  const bad = val == null || val === '';
  switch (cond.op) {
    case 'isEmpty':
      return 'FALSE';
    case 'isNotEmpty':
      return 'TRUE';
    case 'eq':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} = ?`;
    case 'neq':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} != ?`;
    case 'before':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} < ?`;
    case 'after':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} > ?`;
    case 'onOrBefore':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} <= ?`;
    case 'onOrAfter':
      if (bad) return 'FALSE';
      params.push(String(val));
      return `${column} >= ?`;
    default:
      return 'FALSE';
  }
}

// --- sort --------------------------------------------------------------

function buildSorts(sorts: SortSpec[], index: ColumnIndex): SortBuild[] {
  const out: SortBuild[] = [];
  for (let i = 0; i < sorts.length; i++) {
    const s = sorts[i];
    const col = index.byId.get(s.propertyId);
    if (!col) continue;
    const key = `s${i}`;

    const propType = col.property?.type;
    const sys = propType ? SYSTEM_COLUMN_DUCK[propType] : undefined;
    if (sys) {
      out.push({ key, expression: sys, direction: s.direction });
      continue;
    }

    const kind = propType ? propertyKind(propType) : null;
    if (!kind) continue;

    out.push(wrapWithSentinel(col.column, kind, s.direction, key));
  }
  return out;
}

function wrapWithSentinel(
  column: string,
  kind: ReturnType<typeof propertyKind>,
  direction: 'asc' | 'desc',
  key: string,
): SortBuild {
  const colRef = quoteIdent(column);
  let sentinel: string;
  if (kind === PropertyKind.NUMERIC) {
    sentinel = direction === 'asc' ? `'Infinity'::DOUBLE` : `'-Infinity'::DOUBLE`;
  } else if (kind === PropertyKind.DATE) {
    sentinel =
      direction === 'asc'
        ? `'9999-12-31 23:59:59+00'::TIMESTAMPTZ`
        : `'0001-01-01 00:00:00+00'::TIMESTAMPTZ`;
  } else if (kind === PropertyKind.BOOL) {
    sentinel = direction === 'asc' ? 'TRUE' : 'FALSE';
  } else {
    // TEXT / SELECT / MULTI / PERSON / FILE — sort by the column's raw text
    // representation; JSON-typed list columns will stringify in DuckDB
    // lexicographically, matching the Postgres engine's text extractor.
    sentinel = direction === 'asc' ? 'CHR(1114111)' : `''`;
  }
  return {
    key,
    expression: `COALESCE(${colRef}, ${sentinel})`,
    direction,
  };
}

// --- search ------------------------------------------------------------

function buildSearch(spec: SearchSpec, params: unknown[]): string {
  const q = spec.query.trim();
  if (!q) return 'TRUE';
  if (spec.mode === 'fts') {
    throw new FtsNotSupportedInCache();
  }
  params.push(`%${escapeIlike(q)}%`);
  return `search_text ILIKE ?`;
}

// --- keyset ------------------------------------------------------------

function buildKeyset(
  afterKeys: AfterKeys,
  sortBuilds: SortBuild[],
  params: unknown[],
): string {
  // Keys in the same order as ORDER BY: s0..sN, then position, then id.
  // Mirrors cursor-pagination.ts `applyCursor`: builds the lexicographic
  // OR-chain from tail to head, wrapping each step as
  // `(fi > v) OR (fi = v AND <tail>)`.
  //
  // Param binding is positional (1-based `?`). Placeholders appear
  // left-to-right in the final SQL as: leg0(head), leg0(tie), leg1(head),
  // leg1(tie), ..., legN(head). We therefore collect the per-leg params
  // first, then flatten in head→tail order at the end.
  type Leg = { key: string; expression: string; direction: 'asc' | 'desc' };
  const legs: Leg[] = [
    ...sortBuilds.map((s) => ({
      key: s.key,
      expression: s.key,
      direction: s.direction,
    })),
    { key: 'position', expression: 'position', direction: 'asc' },
    { key: 'id', expression: 'id', direction: 'asc' },
  ];

  // Skip legs whose key is absent from afterKeys (shouldn't happen for
  // well-formed cursors, but keeps the builder defensive).
  const usable = legs.filter((l) => l.key in afterKeys);
  if (usable.length === 0) return 'TRUE';

  // legParams[i] = [value, value?] — one push for the head `>` or `<`,
  // one more push for the tie `=` on every leg except the last.
  const legParams: unknown[][] = [];
  let expr = '';
  for (let i = usable.length - 1; i >= 0; i--) {
    const leg = usable[i];
    const value = afterKeys[leg.key];
    const cmp = leg.direction === 'asc' ? '>' : '<';

    const head = `${leg.expression} ${cmp} ?`;

    if (!expr) {
      legParams[i] = [value];
      expr = head;
      continue;
    }
    legParams[i] = [value, value];
    const tie = `${leg.expression} = ?`;
    expr = `(${head} OR (${tie} AND ${expr}))`;
  }

  // Flatten legs in head→tail (placeholder) order.
  for (const values of legParams) {
    for (const v of values) params.push(v);
  }
  return expr;
}

// --- utilities ---------------------------------------------------------

function indexColumns(columns: ColumnSpec[]): ColumnIndex {
  const byId = new Map<string, ColumnSpec>();
  const userColumns: ColumnSpec[] = [];
  for (const c of columns) {
    if (c.property) {
      byId.set(c.property.id, c);
      userColumns.push(c);
    }
  }
  return { byId, userColumns };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function jsonArrayContains(colRef: string, paramPlaceholder: string): string {
  return `json_contains(${colRef}, to_json(${paramPlaceholder}))`;
}

function asStringArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter((v) => v != null).map(String);
  return [String(val)];
}
