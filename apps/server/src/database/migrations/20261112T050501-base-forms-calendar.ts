import { Kysely, sql } from 'kysely';

const FORMULA_BASES = `SELECT page_id FROM base_properties WHERE type = 'formula' AND deleted_at IS NULL`;
const DIGITS_TO_ZERO = `'123456789', '000000000'`;

const IS_REAL_DAY = `(
  substr(v.t, 1, 4)::int >= 1
  AND substr(v.t, 9, 2)::int >= 1
  AND substr(v.t, 9, 2)::int <= CASE
    WHEN substr(v.t, 6, 2)::int IN (1, 3, 5, 7, 8, 10, 12) THEN 31
    WHEN substr(v.t, 6, 2)::int IN (4, 6, 9, 11) THEN 30
    WHEN substr(v.t, 6, 2)::int = 2 THEN
      CASE WHEN (substr(v.t, 1, 4)::int % 4 = 0 AND substr(v.t, 1, 4)::int % 100 <> 0)
                OR substr(v.t, 1, 4)::int % 400 = 0
           THEN 29 ELSE 28
      END
  END
)`;

const SECONDS = `CASE WHEN q.has_seconds THEN substr(v.t, 18, 2)::int ELSE 0 END`;
const OFFSET_HOURS = `CASE WHEN z.zone IN ('', 'Z', 'z') THEN 0 ELSE substr(z.zone, 2, 2)::int END`;
const OFFSET_MINUTES = `CASE WHEN z.zone IN ('', 'Z', 'z') OR length(z.zone) = 3 THEN 0 ELSE right(z.zone, 2)::int END`;

const DATE_PROPERTIES = `
  SELECT page_id,
         array_agg(id) AS ids,
         array_agg(coalesce(type_options -> 'includeTime' = 'true'::jsonb, false)) AS with_time
  FROM base_properties
  WHERE type = 'date' AND deleted_at IS NULL
  GROUP BY page_id
`;

/*
 * The date cells of row r that are released strings, in their new shape, for the date properties d.
 * It reads what legacyDateCell reads and nothing else. It must not fail on any stored value, or the
 * server would not start: a cast runs only inside a CASE branch whose condition has seen digits there.
 */
const DATE_PATCH = `coalesce((
    SELECT jsonb_object_agg(p.id, jsonb_build_object('start', c.start))
    FROM unnest(d.ids, d.with_time) AS p(id, with_time)
    CROSS JOIN LATERAL (
      SELECT CASE WHEN jsonb_typeof(r.cells -> p.id) = 'string' THEN r.cells ->> p.id END AS t
      OFFSET 0
    ) AS v
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN length(v.t) = 24 AND translate(v.t, ${DIGITS_TO_ZERO}) = '0000-00-00T00:00:00.000Z' THEN
          CASE WHEN ${IS_REAL_DAY}
                    AND substr(v.t, 12, 2)::int <= 23
                    AND substr(v.t, 15, 2)::int <= 59
                    AND substr(v.t, 18, 2)::int <= 59
               THEN CASE WHEN p.with_time THEN v.t ELSE left(v.t, 10) END
          END
        WHEN length(v.t) = 10 AND translate(v.t, ${DIGITS_TO_ZERO}) = '0000-00-00' THEN
          CASE WHEN ${IS_REAL_DAY}
               THEN CASE WHEN p.with_time THEN v.t || 'T00:00:00.000Z' ELSE v.t END
          END
        WHEN length(v.t) BETWEEN 16 AND 64
             AND translate(left(v.t, 10), ${DIGITS_TO_ZERO}) = '0000-00-00'
             AND substr(v.t, 11, 1) IN ('T', 't', ' ')
             AND translate(substr(v.t, 12, 5), ${DIGITS_TO_ZERO}) = '00:00' THEN (
          SELECT CASE
            WHEN x.moment >= make_timestamp(1, 1, 1, 0, 0, 0) AND x.moment < make_timestamp(10000, 1, 1, 0, 0, 0) THEN
              CASE WHEN p.with_time
                   THEN to_char(x.moment, 'YYYY-MM-DD"T"HH24:MI:SS') || '.' || rpad(left(q.fraction, 3), 3, '0') || 'Z'
                   ELSE to_char(x.moment, 'YYYY-MM-DD')
              END
          END
          FROM (
            SELECT s.has_seconds,
                   s.has_fraction,
                   CASE WHEN s.has_fraction
                        THEN left(substr(v.t, 21), length(substr(v.t, 21)) - length(ltrim(substr(v.t, 21), '0123456789')))
                        ELSE ''
                   END AS fraction
            FROM (
              SELECT substr(v.t, 17, 1) = ':' AS has_seconds,
                     substr(v.t, 17, 1) = ':' AND substr(v.t, 20, 1) = '.' AS has_fraction
            ) AS s
            OFFSET 0
          ) AS q
          CROSS JOIN LATERAL (
            SELECT substr(v.t, 17 + CASE WHEN q.has_seconds THEN 3 ELSE 0 END
                                  + CASE WHEN q.has_fraction THEN 1 + length(q.fraction) ELSE 0 END) AS rest
            OFFSET 0
          ) AS e
          CROSS JOIN LATERAL (
            SELECT CASE WHEN left(e.rest, 1) = ' ' THEN substr(e.rest, 2) ELSE e.rest END AS zone
            OFFSET 0
          ) AS z
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN (NOT q.has_seconds OR translate(substr(v.t, 18, 2), ${DIGITS_TO_ZERO}) = '00')
                   AND (NOT q.has_fraction OR length(q.fraction) BETWEEN 1 AND 9)
                   AND (e.rest = '' OR translate(z.zone, ${DIGITS_TO_ZERO})
                        IN ('Z', 'z', '+00', '-00', '+0000', '-0000', '+00:00', '-00:00')) THEN
                CASE
                  WHEN ${IS_REAL_DAY}
                       AND substr(v.t, 12, 2)::int <= 23 AND substr(v.t, 15, 2)::int <= 59 AND (${SECONDS}) <= 59
                       AND (${OFFSET_HOURS}) <= 23 AND (${OFFSET_MINUTES}) <= 59
                  THEN make_timestamp(substr(v.t, 1, 4)::int, substr(v.t, 6, 2)::int, substr(v.t, 9, 2)::int,
                                      substr(v.t, 12, 2)::int, substr(v.t, 15, 2)::int, ${SECONDS})
                       - make_interval(mins => CASE WHEN left(z.zone, 1) = '-' THEN -1 ELSE 1 END
                                               * ((${OFFSET_HOURS}) * 60 + (${OFFSET_MINUTES})))
                END
            END AS moment
            OFFSET 0
          ) AS x
        )
      END AS start
    ) AS c
    WHERE c.start IS NOT NULL
  ), '{}'::jsonb)`;

// Bases with a formula are left to the pass that also recomputes them.
const CONVERT_DATE_CELLS = `
  UPDATE base_rows AS r
  SET cells = r.cells || ${DATE_PATCH}
  FROM (${DATE_PROPERTIES}) AS d
  WHERE r.page_id = d.page_id
    AND d.page_id NOT IN (${FORMULA_BASES})
    AND EXISTS (
      SELECT 1 FROM unnest(d.ids) AS i(id)
      WHERE jsonb_typeof(r.cells -> i.id) = 'string'
        AND translate(left(r.cells ->> i.id, 10), ${DIGITS_TO_ZERO}) = '0000-00-00'
    )
`;

const FORMULA_BATCH = 2000;
const FORMULA_PLANS_KEPT = 5000;
const FORMULA_NEEDS_EDIT_CELL = {
  __err: 'TYPE_MISMATCH',
  msg: 'formula needs to be edited',
  v: 1,
};

type FormulaEngine = typeof import('@docmost/base-formula/server');
type StoredProperty = { id: string; name: string; type: string; typeOptions: any };
type FormulaPlan = {
  order: StoredProperty[];
  broken: Set<string>;
  lookup: Map<string, { id: string; type: string; typeOptions: unknown }>;
};

async function propertiesByBase(
  db: Kysely<any>,
  pageIds: string[],
): Promise<Map<string, StoredProperty[]>> {
  // jsonb is read as text: the server's camel case plugin renames keys inside it
  const { rows } = await sql<{
    page: string;
    id: string;
    name: string;
    type: string;
    options: string | null;
  }>`
    SELECT page_id::text AS page, id, name, type, type_options::text AS options
    FROM base_properties
    WHERE page_id = ANY(${pageIds}::uuid[]) AND deleted_at IS NULL
    ORDER BY page_id, position COLLATE "C"
  `.execute(db);
  const byBase = new Map<string, StoredProperty[]>();
  for (const row of rows) {
    const list = byBase.get(row.page) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      type: row.type,
      typeOptions: row.options === null ? null : JSON.parse(row.options),
    });
    byBase.set(row.page, list);
  }
  return byBase;
}

async function rederiveFormulaOptions(
  db: Kysely<any>,
  engine: FormulaEngine,
): Promise<void> {
  const { rows } = await sql<{ id: string }>`
    SELECT DISTINCT page_id::text AS id FROM (${sql.raw(FORMULA_BASES)}) AS f ORDER BY 1
  `.execute(db);
  const pageIds = rows.map((row) => row.id);

  for (let at = 0; at < pageIds.length; at += 200) {
    const pages: string[] = [];
    const ids: string[] = [];
    const before: string[] = [];
    const after: string[] = [];

    for (const [pageId, properties] of await propertiesByBase(db, pageIds.slice(at, at + 200))) {
      const changes: Array<{ id: string; before: unknown; after: unknown }> = [];
      try {
        const current = new Map(properties.map((p) => [p.id, p]));
        for (const id of new engine.BaseFormulaGraph(properties).evalOrder()) {
          const property = current.get(id);
          if (property?.type !== 'formula') continue;
          const stored = property.typeOptions ?? {};
          const derived = engine.deriveFormulaOptions(stored.ast, [...current.values()]);
          if (!derived) continue;
          if (
            stored.resultType === derived.resultType &&
            stored.volatile === derived.volatile &&
            JSON.stringify(stored.dependencies) === JSON.stringify(derived.dependencies)
          ) {
            continue;
          }
          const typeOptions = {
            source: stored.source,
            ast: stored.ast,
            astVersion: 1,
            resultType: derived.resultType,
            dependencies: derived.dependencies,
            volatile: derived.volatile,
          };
          current.set(id, { ...property, typeOptions });
          changes.push({ id, before: property.typeOptions, after: typeOptions });
        }
      } catch (err) {
        console.warn(
          `Formulas of base ${pageId} were left as they are: ${(err as Error).message}`,
        );
        continue;
      }
      for (const change of changes) {
        pages.push(pageId);
        ids.push(change.id);
        before.push(JSON.stringify(change.before));
        after.push(JSON.stringify(change.after));
      }
    }

    if (ids.length === 0) continue;
    await sql`
      UPDATE base_properties AS p
      SET type_options = u.after::jsonb,
          schema_version = p.schema_version + 1,
          updated_at = now()
      FROM unnest(${pages}::uuid[], ${ids}::text[], ${before}::text[], ${after}::text[])
        AS u(page, id, before, after)
      WHERE p.page_id = u.page AND p.id = u.id AND p.deleted_at IS NULL
        AND p.type_options = u.before::jsonb
    `.execute(db);
  }
}

function planFormulas(engine: FormulaEngine, properties: StoredProperty[]): FormulaPlan {
  const plan: FormulaPlan = {
    order: [],
    broken: new Set(),
    lookup: new Map(
      properties.map((p) => [p.id, { id: p.id, type: p.type, typeOptions: p.typeOptions }]),
    ),
  };
  try {
    const formulas = new Map(
      properties.filter((p) => p.type === 'formula').map((p) => [p.id, p]),
    );
    const order = new engine.BaseFormulaGraph(properties)
      .evalOrder()
      .filter((id) => formulas.has(id))
      .map((id) => formulas.get(id));
    for (const p of order) {
      if (engine.deriveFormulaOptions(p.typeOptions?.ast, properties) === null) {
        plan.broken.add(p.id);
      }
    }
    plan.order = order;
  } catch {
    // the formula cells of this base stay as they are; its dates are converted all the same
  }
  return plan;
}

// A row of a base with a formula is written once, with its dates and its formula results together.
async function convertFormulaBases(
  db: Kysely<any>,
  engine: FormulaEngine,
): Promise<void> {
  const now = new Date();
  const plans = new Map<string, FormulaPlan>();
  await sql`
    DECLARE base_formula_rows NO SCROLL CURSOR FOR
    SELECT r.id::text AS id, r.page_id::text AS page, r.cells::text AS cells,
           ${sql.raw(DATE_PATCH)}::text AS dates,
           floor(extract(epoch FROM r.created_at) * 1000)::float8 AS created,
           floor(extract(epoch FROM r.updated_at) * 1000)::float8 AS updated
    FROM base_rows AS r
    LEFT JOIN (${sql.raw(DATE_PROPERTIES)}) AS d ON d.page_id = r.page_id
    WHERE r.page_id IN (${sql.raw(FORMULA_BASES)})
  `.execute(db);

  for (;;) {
    const { rows } = await sql<{
      id: string;
      page: string;
      cells: string;
      dates: string;
      created: number;
      updated: number;
    }>`FETCH ${sql.raw(String(FORMULA_BATCH))} FROM base_formula_rows`.execute(db);
    if (rows.length === 0) break;

    if (plans.size > FORMULA_PLANS_KEPT) plans.clear();
    const unplanned = [...new Set(rows.map((row) => row.page))].filter((page) => !plans.has(page));
    if (unplanned.length > 0) {
      const properties = await propertiesByBase(db, unplanned);
      for (const page of unplanned) {
        plans.set(page, planFormulas(engine, properties.get(page) ?? []));
      }
    }

    const ids: string[] = [];
    const patches: string[] = [];
    const dropped: Array<string | null> = [];

    for (const row of rows) {
      const stored = JSON.parse(row.cells);
      if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) continue;
      const plan = plans.get(row.page);
      const patch: Record<string, unknown> = JSON.parse(row.dates);

      if (plan.order.length > 0) {
        try {
          const cells = { ...stored, ...patch };
          const computed: Record<string, unknown> = {};
          const ctx = engine.createEvalContext({
            properties: plan.lookup,
            zone: 'UTC',
            now,
            createdAt: new Date(row.created),
            updatedAt: new Date(row.updated),
          });
          for (const id of plan.broken) ctx.memo.set(id, FORMULA_NEEDS_EDIT_CELL as any);
          for (const property of plan.order) {
            computed[property.id] = plan.broken.has(property.id)
              ? FORMULA_NEEDS_EDIT_CELL
              : engine.evaluateCell(property.typeOptions, { ...cells, ...computed }, ctx);
          }
          for (const [id, cell] of Object.entries(computed)) {
            if (!engine.formulaCellsEqual(cell, stored[id])) patch[id] = cell;
          }
        } catch {
          // the row keeps its formula cells
        }
      }

      const entries = Object.entries(patch);
      if (entries.length === 0) continue;
      const empty = entries.filter(([, cell]) => cell === null).map(([id]) => id);
      ids.push(row.id);
      patches.push(JSON.stringify(Object.fromEntries(entries.filter(([, cell]) => cell !== null))));
      dropped.push(empty.length > 0 ? JSON.stringify(empty) : null);
    }

    if (ids.length === 0) continue;
    // an empty formula result removes its key
    await sql`
      UPDATE base_rows AS r
      SET cells = CASE
        WHEN u.dropped IS NULL THEN r.cells || u.patch::jsonb
        ELSE (r.cells - ARRAY(SELECT jsonb_array_elements_text(u.dropped::jsonb))) || u.patch::jsonb
      END
      FROM unnest(${ids}::uuid[], ${patches}::text[], ${dropped}::text[]) AS u(id, patch, dropped)
      WHERE r.id = u.id
    `.execute(db);
  }

  await sql`CLOSE base_formula_rows`.execute(db);
}

// Formula results cannot be recomputed in SQL; the engine is loaded only when a base has a formula.
async function convertBasesWithFormulas(db: Kysely<any>): Promise<void> {
  const { rows } = await sql<{ found: boolean }>`
    SELECT EXISTS (${sql.raw(FORMULA_BASES)}) AS found
  `.execute(db);
  if (!rows[0].found) return;

  const engine = await import('@docmost/base-formula/server');
  await rederiveFormulaOptions(db, engine);
  await convertFormulaBases(db, engine);
}

const LOCK_WAIT = '2s';
const LOCK_ATTEMPTS = 30;
const LOCK_NOT_AVAILABLE = '55P03';
const DEADLOCK_DETECTED = '40P01';

/*
 * Every lock this migration needs, taken before it changes anything. An older instance that is
 * still serving requests then waits for the whole conversion. Left to write alongside it, such an
 * instance can deadlock with the migration, and PostgreSQL then aborts the migration.
 */
async function lockTables(db: Kysely<any>): Promise<void> {
  const { rows } = await sql<{ previous: string }>`
    SELECT current_setting('lock_timeout') AS previous
  `.execute(db);
  await sql`SELECT set_config('lock_timeout', ${LOCK_WAIT}, true)`.execute(db);

  for (let attempt = 1; ; attempt++) {
    await sql`SAVEPOINT base_conversion_locks`.execute(db);
    try {
      await sql`
        LOCK TABLE base_rows, base_properties, base_views, workspaces, users
        IN SHARE ROW EXCLUSIVE MODE
      `.execute(db);
      await sql`LOCK TABLE pages IN ACCESS EXCLUSIVE MODE`.execute(db);
      await sql`RELEASE SAVEPOINT base_conversion_locks`.execute(db);
      break;
    } catch (err) {
      await sql`ROLLBACK TO SAVEPOINT base_conversion_locks`.execute(db);
      const code = (err as { code?: string }).code;
      if (attempt === LOCK_ATTEMPTS || (code !== LOCK_NOT_AVAILABLE && code !== DEADLOCK_DETECTED)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  await sql`SELECT set_config('lock_timeout', ${rows[0].previous}, true)`.execute(db);
}

export async function up(db: Kysely<any>): Promise<void> {
  await lockTables(db);
  await sql.raw(CONVERT_DATE_CELLS).execute(db);
  await convertBasesWithFormulas(db);
  await sql`
    UPDATE pages
    SET base_schema_version = base_schema_version + 1
    WHERE is_base
      AND id IN (
        SELECT page_id FROM base_properties
        WHERE type IN ('date', 'formula') AND deleted_at IS NULL
      )
  `.execute(db);

  await db.schema
    .createTable('base_view_shares')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('key', 'varchar', (col) => col.notNull().unique())
    .addColumn('view_id', 'uuid', (col) =>
      col.references('base_views.id').onDelete('cascade').notNull().unique(),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('access', 'varchar', (col) => col.notNull().defaultTo('none'))
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_base_view_shares_page_id')
    .on('base_view_shares')
    .column('page_id')
    .execute();

  await db.schema.alterTable('pages').addColumn('base_time_zone', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').dropColumn('base_time_zone').execute();
  await db.schema.dropTable('base_view_shares').execute();

  // Lossy: the end of a range is dropped, and formula cells keep the values the newer engine computed.
  await sql`
    UPDATE base_rows AS r
    SET cells = r.cells || coalesce((
      SELECT jsonb_object_agg(
        i.id,
        to_jsonb(CASE WHEN length(s.start) = 10 THEN s.start || 'T00:00:00.000Z' ELSE s.start END)
      )
      FROM unnest(d.ids) AS i(id)
      CROSS JOIN LATERAL (SELECT r.cells -> i.id ->> 'start' AS start OFFSET 0) AS s
      WHERE jsonb_typeof(r.cells -> i.id -> 'start') = 'string'
    ), '{}'::jsonb)
    FROM (
      SELECT page_id, array_agg(id) AS ids
      FROM base_properties
      WHERE type IN ('date', 'formula') AND deleted_at IS NULL
      GROUP BY page_id
    ) AS d
    WHERE r.page_id = d.page_id
      AND EXISTS (
        SELECT 1 FROM unnest(d.ids) AS i(id)
        WHERE jsonb_typeof(r.cells -> i.id -> 'start') = 'string'
      )
  `.execute(db);

  await sql`
    UPDATE base_properties
    SET type_options = jsonb_set(type_options, '{resultType}', '"date"')
    WHERE type = 'formula' AND type_options ->> 'resultType' = 'datetime'
  `.execute(db);
  await sql`
    UPDATE base_properties
    SET type_options = type_options - 'volatile'
    WHERE type = 'formula' AND type_options ? 'volatile'
  `.execute(db);
  await sql`
    UPDATE pages SET base_schema_version = base_schema_version + 1 WHERE is_base
  `.execute(db);
}
