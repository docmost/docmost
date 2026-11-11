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
    CREATE OR REPLACE FUNCTION base_date_fallback(
      v text, OUT wall timestamp, OUT moment timestamptz, OUT zoned boolean)
    LANGUAGE plpgsql STABLE
    SET TimeZone = 'UTC' SET DateStyle = 'ISO, MDY'
    AS $$
      BEGIN
        wall := v::timestamp;
        moment := v::timestamptz;
        PERFORM set_config('TimeZone', 'Asia/Tokyo', true);
        zoned := v::timestamptz = moment;
        moment := base_date_year_ok(moment);
      EXCEPTION WHEN others THEN
        wall := NULL;
        moment := NULL;
        zoned := NULL;
      END
    $$
  `.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION base_date_migrate(v text, include_time boolean)
    RETURNS text LANGUAGE plpgsql STABLE
    AS $$
      DECLARE
        t text;
        parts text[];
        wall timestamp;
        moment timestamptz := base_date_instant(v);
        zoned boolean;
      BEGIN
        IF base_date_is_ymd(base_date_legacy(v)) THEN
          RETURN base_date_legacy(v);
        END IF;
        IF moment IS NOT NULL THEN
          wall := v::timestamp;
          zoned := v ~ '(Z|[+-][0-9]{2}:[0-9]{2})$';
        ELSIF v !~* '(now|today|tomorrow|yesterday|epoch|infinity|allballs)' THEN
          t := regexp_replace(v, '[[:space:]]*[(][^()]*[)][[:space:]]*$', '');
          parts := regexp_match(t, '(gmt|utc|ut)[[:space:]]*([+-])([0-9]{2}):?([0-9]{2})[[:>:]]', 'i');
          IF parts IS NOT NULL THEN
            t := regexp_replace(t, '(gmt|utc|ut)[[:space:]]*[+-][0-9]{2}:?[0-9]{2}[[:>:]]',
                                ' ' || parts[2] || parts[3] || ':' || parts[4], 'i');
          END IF;
          IF t !~* '(gmt|utc|ut)[[:space:]]*[+-]' AND t !~ '[0-9]:[0-9]{2}.*[[:alpha:]][+-][0-9]' THEN
            SELECT f.wall, f.moment, f.zoned INTO wall, moment, zoned FROM base_date_fallback(t) f;
          END IF;
          IF extract(year FROM wall) BETWEEN 2050 AND 2069
             AND strpos(t, to_char(wall, 'YYYY')) = 0 AND t !~ '[0-9]{5}' THEN
            wall := wall - interval '100 years';
            moment := ((moment AT TIME ZONE 'UTC') - interval '100 years') AT TIME ZONE 'UTC';
          END IF;
        END IF;
        IF wall IS NULL OR moment IS NULL OR extract(year FROM wall) NOT BETWEEN 1 AND 9999 THEN
          RETURN NULL;
        END IF;
        IF (wall::time = time '00:00' AND NOT (zoned AND include_time))
           OR (NOT zoned AND NOT include_time) THEN
          RETURN to_char(wall, 'YYYY-MM-DD');
        END IF;
        RETURN to_char(moment AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      END
    $$
  `.execute(db);

  const { rows: abbreviations } = await sql<{ setting: string }>`
    SELECT current_setting('timezone_abbreviations') AS setting
  `.execute(db);
  await sql`SELECT set_config('timezone_abbreviations', 'Default', false)`.execute(db);

  await sql`
    WITH src AS MATERIALIZED (
      SELECT r.id,
             p.id AS prop,
             base_date_migrate(
               r.cells ->> p.id,
               coalesce(p.type_options ->> 'includeTime' = 'true', false)
             ) AS start
      FROM base_rows r
      JOIN base_properties p ON p.page_id = r.page_id AND p.type = 'date'
      WHERE jsonb_typeof(r.cells -> p.id) = 'string'
    ),
    conv AS (
      SELECT id, jsonb_object_agg(prop, jsonb_build_object('start', start)) AS patch
      FROM src
      WHERE start IS NOT NULL
      GROUP BY id
    )
    UPDATE base_rows r SET cells = r.cells || conv.patch FROM conv WHERE r.id = conv.id
  `.execute(db);

  await sql`
    SELECT set_config('timezone_abbreviations', ${abbreviations[0].setting}, false)
  `.execute(db);

  await sql`DROP FUNCTION base_date_migrate(text, boolean)`.execute(db);
  await sql`DROP FUNCTION base_date_fallback(text)`.execute(db);

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
