import * as path from 'path';
import * as dotenv from 'dotenv';
import { Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { v7 as uuid7 } from 'uuid';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

const TOTAL_ROWS = 1500;
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

const COLORS = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray',
];

function randomWords(min: number, max: number): string {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return result.join(' ');
}

function makeChoices(names: string[], category?: string) {
  return names.map((name, i) => ({
    id: uuid7(),
    name,
    color: COLORS[i % COLORS.length],
    ...(category ? {} : {}),
  }));
}

function makeStatusChoices() {
  const todo = [{ id: uuid7(), name: 'Not Started', color: 'gray', category: 'todo' }];
  const inProgress = [
    { id: uuid7(), name: 'In Progress', color: 'blue', category: 'inProgress' },
    { id: uuid7(), name: 'In Review', color: 'purple', category: 'inProgress' },
  ];
  const complete = [
    { id: uuid7(), name: 'Done', color: 'green', category: 'complete' },
    { id: uuid7(), name: 'Cancelled', color: 'red', category: 'complete' },
  ];
  const all = [...todo, ...inProgress, ...complete];
  return { choices: all, choiceOrder: all.map((c) => c.id) };
}

type PropertyDef = {
  name: string;
  type: string;
  isPrimary?: boolean;
  typeOptions?: any;
};

function buildPropertyDefinitions(): PropertyDef[] {
  const priorityChoices = makeChoices(['Low', 'Medium', 'High', 'Critical']);
  const categoryChoices = makeChoices(['Engineering', 'Design', 'Marketing', 'Sales', 'Support', 'Operations']);
  const tagChoices = makeChoices(['Bug', 'Feature', 'Improvement', 'Documentation', 'Research']);
  const statusOpts = makeStatusChoices();

  return [
    { name: 'Title', type: 'text', isPrimary: true },
    { name: 'Status', type: 'status', typeOptions: statusOpts },
    { name: 'Priority', type: 'select', typeOptions: { choices: priorityChoices, choiceOrder: priorityChoices.map((c) => c.id) } },
    { name: 'Category', type: 'select', typeOptions: { choices: categoryChoices, choiceOrder: categoryChoices.map((c) => c.id) } },
    { name: 'Tags', type: 'multiSelect', typeOptions: { choices: tagChoices, choiceOrder: tagChoices.map((c) => c.id) } },
    { name: 'Due Date', type: 'date', typeOptions: { dateFormat: 'YYYY-MM-DD', includeTime: false } },
    { name: 'Estimate', type: 'number', typeOptions: { format: 'plain', precision: 1 } },
    { name: 'Budget', type: 'number', typeOptions: { format: 'currency', precision: 2, currencySymbol: '$' } },
    { name: 'Approved', type: 'checkbox' },
    { name: 'Website', type: 'url' },
    { name: 'Contact Email', type: 'email' },
    { name: 'Notes', type: 'text' },
    { name: 'Created', type: 'createdAt' },
    { name: 'Last Edited', type: 'lastEditedAt' },
  ];
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

async function createBase(workspaceId: string, spaceId: string, creatorId: string | null): Promise<string> {
  const baseId = uuid7();
  const baseName = `Seed Base ${new Date().toISOString().slice(0, 16)}`;

  await db.insertInto('bases').values({
    id: baseId,
    name: baseName,
    space_id: spaceId,
    workspace_id: workspaceId,
    creator_id: creatorId,
    created_at: new Date(),
    updated_at: new Date(),
  }).execute();

  console.log(`Created base: ${baseName}`);
  console.log(`Base ID: ${baseId}\n`);

  // Create properties
  const propertyDefs = buildPropertyDefinitions();
  let propPosition: string | null = null;
  const insertedProperties: any[] = [];

  for (const def of propertyDefs) {
    propPosition = generateJitteredKeyBetween(propPosition, null);
    const prop = {
      id: uuid7(),
      base_id: baseId,
      name: def.name,
      type: def.type,
      position: propPosition,
      type_options: def.typeOptions ? JSON.stringify(def.typeOptions) : null,
      is_primary: def.isPrimary ?? false,
      workspace_id: workspaceId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    insertedProperties.push(prop);
  }

  await db.insertInto('base_properties').values(insertedProperties).execute();
  console.log(`Created ${insertedProperties.length} properties:`);
  for (const p of insertedProperties) {
    console.log(`  - ${p.name} (${p.type})${p.is_primary ? ' [primary]' : ''}${SKIP_TYPES.has(p.type) ? ' [system]' : ''}`);
  }

  // Create default view
  const viewId = uuid7();
  await db.insertInto('base_views').values({
    id: viewId,
    base_id: baseId,
    name: 'Table View 1',
    type: 'table',
    position: generateJitteredKeyBetween(null, null),
    config: JSON.stringify({}),
    workspace_id: workspaceId,
    creator_id: creatorId,
    created_at: new Date(),
    updated_at: new Date(),
  }).execute();
  console.log(`Created view: Table View 1\n`);

  return baseId;
}

async function main() {
  const spaceId = '019c69a3-dd47-7014-8b87-ec8f167577ee';

  const space = await db
    .selectFrom('spaces')
    .select(['id', 'workspace_id'])
    .where('id', '=', spaceId)
    .executeTakeFirstOrThrow();

  const workspaceId = space.workspace_id;

  const user = await db
    .selectFrom('users')
    .select('id')
    .limit(1)
    .executeTakeFirst();

  const creatorId = user?.id ?? null;

  console.log(`Workspace: ${workspaceId}`);
  console.log(`Space: ${spaceId}`);
  console.log(`Creator: ${creatorId ?? '(none)'}\n`);

  // Create the base with properties and view
  const baseId = await createBase(workspaceId, spaceId, creatorId);

  // Load the created properties for cell generation
  const properties = await db
    .selectFrom('base_properties')
    .selectAll()
    .where('base_id', '=', baseId)
    .execute();

  const generators: Array<{ propertyId: string; generate: CellGenerator }> = [];
  for (const prop of properties) {
    const gen = buildCellGenerator(prop);
    if (gen) {
      generators.push({ propertyId: prop.id, generate: gen });
    }
  }

  console.log(`Generating ${TOTAL_ROWS.toLocaleString()} positions...`);

  let lastPosition: string | null = null;
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
        base_id: baseId,
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
  console.log(`\nBase ID: ${baseId}`);

  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  db.destroy().finally(() => process.exit(1));
});
