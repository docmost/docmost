import * as path from 'path';
import * as dotenv from 'dotenv';
import { Kysely, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { v7 as uuid7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

const BASE_ID = '019c69a5-1d84-7985-a7f6-8ee2871d8669';
const TOTAL_ROWS = 100_000;
const BATCH_SIZE = 2000;

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

const SKIP_TYPES = new Set([
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'person',
  'file',
]);

const WORDS = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf',
  'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November',
  'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform',
  'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu', 'Report', 'Analysis',
  'Summary', 'Review', 'Update', 'Draft', 'Final', 'Proposal', 'Budget',
  'Timeline', 'Milestone', 'Objective', 'Strategy', 'Initiative',
];

function randomWords(min: number, max: number): string {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return result.join(' ');
}

type CellGenerator = () => unknown;

function buildCellGenerator(property: any): CellGenerator | null {
  if (SKIP_TYPES.has(property.type)) return null;

  const typeOptions = property.type_options;

  switch (property.type) {
    case 'text':
      return () => randomWords(2, 6);

    case 'number':
      return () => Math.round(Math.random() * 10000 * 100) / 100;

    case 'select':
    case 'status': {
      const choices = typeOptions?.choices ?? [];
      if (choices.length === 0) return null;
      return () => choices[Math.floor(Math.random() * choices.length)].id;
    }

    case 'multiSelect': {
      const choices = typeOptions?.choices ?? [];
      if (choices.length === 0) return () => [];
      return () => {
        const count = 1 + Math.floor(Math.random() * Math.min(3, choices.length));
        const shuffled = [...choices].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count).map((c: any) => c.id);
      };
    }

    case 'date': {
      const start = new Date(2020, 0, 1).getTime();
      const range = new Date(2026, 0, 1).getTime() - start;
      return () => new Date(start + Math.random() * range).toISOString();
    }

    case 'checkbox':
      return () => Math.random() > 0.5;

    case 'url':
      return () => `https://example.com/page/${Math.floor(Math.random() * 100000)}`;

    case 'email':
      return () => `user${Math.floor(Math.random() * 100000)}@example.com`;

    default:
      return null;
  }
}

async function main() {
  console.log(`Seeding ${TOTAL_ROWS.toLocaleString()} rows for base ${BASE_ID}\n`);

  const base = await db
    .selectFrom('bases')
    .selectAll()
    .where('id', '=', BASE_ID)
    .executeTakeFirstOrThrow();

  const workspaceId = base.workspace_id;
  console.log(`Workspace: ${workspaceId}`);

  const user = await db
    .selectFrom('users')
    .select('id')
    .limit(1)
    .executeTakeFirst();

  const creatorId = user?.id ?? null;
  console.log(`Creator: ${creatorId ?? '(none)'}`);

  const properties = await db
    .selectFrom('base_properties')
    .selectAll()
    .where('base_id', '=', BASE_ID)
    .execute();

  console.log(`Properties: ${properties.length}`);
  for (const p of properties) {
    console.log(`  - ${p.name} (${p.type})${SKIP_TYPES.has(p.type) ? ' [skipped]' : ''}`);
  }

  const generators: Array<{ propertyId: string; generate: CellGenerator }> = [];
  for (const prop of properties) {
    const gen = buildCellGenerator(prop);
    if (gen) {
      generators.push({ propertyId: prop.id, generate: gen });
    }
  }

  console.log(`\nGenerating ${TOTAL_ROWS.toLocaleString()} positions...`);

  const lastRow = await db
    .selectFrom('base_rows')
    .select('position')
    .where('base_id', '=', BASE_ID)
    .where('deleted_at', 'is', null)
    .orderBy(sql`position COLLATE "C"`, sql`desc`)
    .limit(1)
    .executeTakeFirst();

  let lastPosition: string | null = lastRow?.position ?? null;
  const positions: string[] = new Array(TOTAL_ROWS);
  for (let i = 0; i < TOTAL_ROWS; i++) {
    lastPosition = generateJitteredKeyBetween(lastPosition, null);
    positions[i] = lastPosition;
  }
  console.log(`Positions generated (last: ${positions[positions.length - 1]})\n`);

  const startTime = Date.now();
  const totalBatches = Math.ceil(TOTAL_ROWS / BATCH_SIZE);

  for (let batchStart = 0; batchStart < TOTAL_ROWS; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_ROWS);
    const rows: any[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const cells: Record<string, unknown> = {};
      for (const { propertyId, generate } of generators) {
        cells[propertyId] = generate();
      }

      rows.push({
        id: uuid7(),
        base_id: BASE_ID,
        cells,
        position: positions[i],
        creator_id: creatorId,
        workspace_id: workspaceId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    await db.insertInto('base_rows').values(rows).execute();

    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Batch ${batchNum}/${totalBatches} inserted (${batchEnd.toLocaleString()} rows, ${elapsed}s elapsed)`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone. Inserted ${TOTAL_ROWS.toLocaleString()} rows in ${totalElapsed}s`);

  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  db.destroy().finally(() => process.exit(1));
});
