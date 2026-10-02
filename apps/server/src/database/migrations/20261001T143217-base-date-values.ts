// Assumes a single-instance cutover: during a rolling deploy, old instances would evaluate
// formulas over the new object-shaped date cells as null and persist wrong formula outputs.
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION base_date_is_ymd(v text)
    RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
      SELECT CASE
        WHEN v ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' AND left(v, 4) <> '0000'
        THEN extract(month FROM make_date(left(v, 4)::int, substr(v, 6, 2)::int, 1)
                     + (substr(v, 9, 2)::int - 1)) = substr(v, 6, 2)::int
        ELSE false
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_year_ok(t timestamptz)
    RETURNS timestamptz LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
      SELECT CASE WHEN extract(year FROM t AT TIME ZONE 'UTC') BETWEEN 1 AND 9999 THEN t END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_instant(v text)
    RETURNS timestamptz LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
      SELECT CASE
        WHEN coalesce(
          v ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]{1,3})?)?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])?$'
          AND left(v, 4) <> '0000', false)
        THEN
          CASE WHEN extract(month FROM make_date(left(v, 4)::int, substr(v, 6, 2)::int, 1)
                            + (substr(v, 9, 2)::int - 1)) = substr(v, 6, 2)::int
          THEN
            CASE
              WHEN v ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
                CASE WHEN left(v, 4) IN ('0001', '9999') THEN base_date_year_ok(v::timestamptz) ELSE v::timestamptz END
              ELSE v::timestamp AT TIME ZONE 'UTC'
            END
          END
        END
      $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_legacy(v text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
      SELECT CASE WHEN v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00([.]0{1,3})?Z$' THEN left(v, 10) ELSE v END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_bound(v text, tz text, is_end boolean)
    RETURNS timestamptz LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
      SELECT CASE
        WHEN base_date_is_ymd(v)
          THEN ((v::date + CASE WHEN is_end THEN 1 ELSE 0 END)::timestamp AT TIME ZONE tz)
        ELSE base_date_instant(v)
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_range_end(s text, e text, tz text)
    RETURNS timestamptz LANGUAGE sql STABLE PARALLEL SAFE
    AS $$
      SELECT CASE
        WHEN base_date_is_ymd(s) THEN
          CASE WHEN base_date_is_ymd(e) AND e >= s
            THEN ((e::date + 1)::timestamp AT TIME ZONE tz)
            ELSE ((s::date + 1)::timestamp AT TIME ZONE tz)
          END
        ELSE
          CASE WHEN base_date_instant(e) > base_date_instant(s)
            THEN base_date_instant(e)
            ELSE base_date_instant(s) + interval '1 microsecond'
          END
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_date_start(cells jsonb, prop text, tz text)
    RETURNS timestamptz LANGUAGE plpgsql STABLE PARALLEL SAFE
    AS $$
      DECLARE v jsonb := cells -> prop;
      BEGIN
        RETURN CASE jsonb_typeof(v)
          WHEN 'object' THEN base_date_bound(v ->> 'start', tz, false)
          WHEN 'string' THEN base_date_bound(base_date_legacy(v #>> '{}'), tz, false)
        END;
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_cell_date_end(cells jsonb, prop text, tz text)
    RETURNS timestamptz LANGUAGE plpgsql STABLE PARALLEL SAFE
    AS $$
      DECLARE v jsonb := cells -> prop;
      BEGIN
        RETURN CASE jsonb_typeof(v)
          WHEN 'object' THEN base_date_range_end(v ->> 'start', v ->> 'end', tz)
          WHEN 'string' THEN base_date_range_end(base_date_legacy(v #>> '{}'), NULL, tz)
        END;
      END
    $$
  `.execute(db);

  await sql`
    WITH conv AS (
      SELECT r.id,
             jsonb_object_agg(
               p.id,
               jsonb_build_object('start',
                 CASE
                   WHEN base_date_is_ymd(base_date_legacy(r.cells ->> p.id))
                     THEN base_date_legacy(r.cells ->> p.id)
                   WHEN p.type_options ->> 'includeTime' IS DISTINCT FROM 'true'
                     THEN to_char(
                       (base_date_instant(r.cells ->> p.id) AT TIME ZONE 'UTC') + interval '12 hours',
                       'YYYY-MM-DD')
                   ELSE to_char(
                     base_date_instant(r.cells ->> p.id) AT TIME ZONE 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                 END)
             ) AS patch
      FROM base_rows r
      JOIN base_properties p ON p.page_id = r.page_id AND p.type = 'date'
      WHERE jsonb_typeof(r.cells -> p.id) = 'string'
        AND (base_date_is_ymd(base_date_legacy(r.cells ->> p.id))
             OR (p.type_options ->> 'includeTime' = 'true'
                 AND base_date_instant(r.cells ->> p.id) IS NOT NULL)
             OR (p.type_options ->> 'includeTime' IS DISTINCT FROM 'true'
                 AND base_date_is_ymd(to_char(
                   (base_date_instant(r.cells ->> p.id) AT TIME ZONE 'UTC') + interval '12 hours',
                   'YYYY-MM-DD'))))
      GROUP BY r.id
    )
    UPDATE base_rows r SET cells = r.cells || conv.patch FROM conv WHERE r.id = conv.id
  `.execute(db);

  await sql`
    UPDATE base_properties SET type_options = type_options - 'dateFormat'
    WHERE type = 'date' AND jsonb_typeof(type_options) = 'object' AND type_options ? 'dateFormat'
      AND coalesce(type_options ->> 'dateFormat', '') NOT IN
          ('full', 'medium', 'monthDayYear', 'dayMonthYear', 'yearMonthDay', 'relative')
  `.execute(db);

  await sql`
    UPDATE base_properties SET pending_type_options = pending_type_options - 'dateFormat'
    WHERE pending_type = 'date' AND jsonb_typeof(pending_type_options) = 'object' AND pending_type_options ? 'dateFormat'
      AND coalesce(pending_type_options ->> 'dateFormat', '') NOT IN
          ('full', 'medium', 'monthDayYear', 'dayMonthYear', 'yearMonthDay', 'relative')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Lossy: the end of a range is dropped.
  await sql`
    WITH conv AS (
      SELECT r.id,
             jsonb_object_agg(
               p.id,
               to_jsonb(
                 CASE
                   WHEN base_date_is_ymd(r.cells -> p.id ->> 'start')
                     THEN (r.cells -> p.id ->> 'start') || 'T00:00:00.000Z'
                   ELSE r.cells -> p.id ->> 'start'
                 END)
             ) AS patch
      FROM base_rows r
      JOIN base_properties p ON p.page_id = r.page_id AND p.type = 'date'
      WHERE jsonb_typeof(r.cells -> p.id) = 'object'
        AND jsonb_typeof(r.cells -> p.id -> 'start') = 'string'
      GROUP BY r.id
    )
    UPDATE base_rows r SET cells = r.cells || conv.patch FROM conv WHERE r.id = conv.id
  `.execute(db);

  await sql`DROP FUNCTION IF EXISTS base_cell_date_end(jsonb, text, text)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_cell_date_start(jsonb, text, text)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_range_end(text, text, text)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_bound(text, text, boolean)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_legacy(text)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_instant(text)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_year_ok(timestamptz)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS base_date_is_ymd(text)`.execute(db);
}
