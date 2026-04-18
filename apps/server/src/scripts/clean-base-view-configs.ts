import * as path from 'path';
import * as dotenv from 'dotenv';
import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

/*
 * One-shot cleanup for `base_views.config` rows that were poisoned by an
 * earlier bug where `{...config}` spread a jsonb-stored string `"{}"`
 * into character-indexed keys (`"0": "{"`, `"1": "}"`). Strips any
 * all-digit string keys from each view's config.
 */

const envFilePath = path.resolve(process.cwd(), '..', '..', '.env');
dotenv.config({ path: envFilePath });

function normalizePostgresUrl(url: string): string {
  const parsed = new URL(url);
  const newParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams) {
    if (key === 'sslmode' && value === 'no-verify') continue;
    if (key === 'schema') continue;
    newParams.append(key, value);
  }
  parsed.search = newParams.toString();
  return parsed.toString();
}

const db = new Kysely<any>({
  dialect: new PostgresJSDialect({
    postgres: postgres(normalizePostgresUrl(process.env.DATABASE_URL!)),
  }),
});

function hasDigitKeys(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  return Object.keys(config).some((k) => /^\d+$/.test(k));
}

function stripDigitKeys(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (/^\d+$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}

async function main() {
  const views = await db
    .selectFrom('base_views')
    .select(['id', 'name', 'base_id', 'config'])
    .execute();

  console.log(`Scanning ${views.length} views...`);

  let fixed = 0;
  let skipped = 0;
  let stringConfigs = 0;

  for (const v of views) {
    let config = v.config;

    // Case 1: config is a STRING (e.g. the original "{}" bug). Replace
    // with an empty object.
    if (typeof config === 'string') {
      stringConfigs++;
      await db
        .updateTable('base_views')
        .set({ config: {} as any })
        .where('id', '=', v.id)
        .execute();
      console.log(`  [string→{}]   ${v.id}  ${v.name}`);
      continue;
    }

    // Case 2: config is an object with poisoned digit keys.
    if (hasDigitKeys(config)) {
      const cleaned = stripDigitKeys(config as Record<string, unknown>);
      await db
        .updateTable('base_views')
        .set({ config: cleaned as any })
        .where('id', '=', v.id)
        .execute();
      fixed++;
      console.log(`  [strip digit] ${v.id}  ${v.name}`);
      continue;
    }

    skipped++;
  }

  console.log(`\nDone. fixed=${fixed} stringified=${stringConfigs} clean=${skipped}`);
  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  db.destroy().finally(() => process.exit(1));
});
