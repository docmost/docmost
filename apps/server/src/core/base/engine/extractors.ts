import { sql, RawBuilder } from 'kysely';

/*
 * Parameterised extractors wrapping the SQL helper functions installed
 * by the bases-hardening migration. PropertyId always binds as a
 * parameter — never string-interpolated. These replace every
 * `sql.raw('cells->>...')` site in the old repo.
 */

export function textCell(propertyId: string): RawBuilder<string> {
  return sql<string>`base_cell_text(cells, ${propertyId}::uuid)`;
}

export function numericCell(propertyId: string): RawBuilder<number> {
  return sql<number>`base_cell_numeric(cells, ${propertyId}::uuid)`;
}

export function dateCell(propertyId: string): RawBuilder<Date> {
  return sql<Date>`base_cell_timestamptz(cells, ${propertyId}::uuid)`;
}

export function boolCell(propertyId: string): RawBuilder<boolean> {
  return sql<boolean>`base_cell_bool(cells, ${propertyId}::uuid)`;
}

export function arrayCell(propertyId: string): RawBuilder<unknown> {
  return sql<unknown>`base_cell_array(cells, ${propertyId}::uuid)`;
}

export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}
