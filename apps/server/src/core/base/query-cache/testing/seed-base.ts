import type { Kysely } from 'kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { v7 as uuid7 } from 'uuid';

export type SeedBaseOptions = {
  db: Kysely<any>;
  workspaceId: string;
  spaceId: string;
  creatorUserId: string | null;
  rows: number;
  name?: string;
};

export type SeededBase = {
  baseId: string;
  propertyIds: {
    title: string;
    status: string;
    priority: string;
    category: string;
    tags: string;
    dueDate: string;
    estimate: string;
    budget: string;
    approved: string;
    website: string;
    contactEmail: string;
    notes: string;
    created: string;
    lastEdited: string;
    // Generic aliases used by parity tests.
    text: string;
    number: string;
    date: string;
  };
  statusChoiceIds: string[];
};

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

// Deterministic RNG (mulberry32) so tests are reproducible.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomWords(rng: () => number, min: number, max: number): string {
  const count = min + Math.floor(rng() * (max - min + 1));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORDS[Math.floor(rng() * WORDS.length)]);
  }
  return result.join(' ');
}

function makeChoices(names: string[]) {
  return names.map((name, i) => ({
    id: uuid7(),
    name,
    color: COLORS[i % COLORS.length],
  }));
}

function makeStatusChoices() {
  const todo = [
    { id: uuid7(), name: 'Not Started', color: 'gray', category: 'todo' },
  ];
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
  const categoryChoices = makeChoices([
    'Engineering',
    'Design',
    'Marketing',
    'Sales',
    'Support',
    'Operations',
  ]);
  const tagChoices = makeChoices([
    'Bug',
    'Feature',
    'Improvement',
    'Documentation',
    'Research',
  ]);
  const statusOpts = makeStatusChoices();

  return [
    { name: 'Title', type: 'text', isPrimary: true },
    { name: 'Status', type: 'status', typeOptions: statusOpts },
    {
      name: 'Priority',
      type: 'select',
      typeOptions: {
        choices: priorityChoices,
        choiceOrder: priorityChoices.map((c) => c.id),
      },
    },
    {
      name: 'Category',
      type: 'select',
      typeOptions: {
        choices: categoryChoices,
        choiceOrder: categoryChoices.map((c) => c.id),
      },
    },
    {
      name: 'Tags',
      type: 'multiSelect',
      typeOptions: {
        choices: tagChoices,
        choiceOrder: tagChoices.map((c) => c.id),
      },
    },
    {
      name: 'Due Date',
      type: 'date',
      typeOptions: { dateFormat: 'YYYY-MM-DD', includeTime: false },
    },
    {
      name: 'Estimate',
      type: 'number',
      typeOptions: { format: 'plain', precision: 1 },
    },
    {
      name: 'Budget',
      type: 'number',
      typeOptions: { format: 'currency', precision: 2, currencySymbol: '$' },
    },
    { name: 'Approved', type: 'checkbox' },
    { name: 'Website', type: 'url' },
    { name: 'Contact Email', type: 'email' },
    { name: 'Notes', type: 'text' },
    { name: 'Created', type: 'createdAt' },
    { name: 'Last Edited', type: 'lastEditedAt' },
  ];
}

type CellGenerator = () => unknown;

function buildCellGenerator(
  property: any,
  rng: () => number,
): CellGenerator | null {
  if (SKIP_TYPES.has(property.type)) return null;

  const typeOptions = property.type_options ?? property.typeOptions;

  switch (property.type) {
    case 'text':
      return () => randomWords(rng, 2, 6);

    case 'number':
      return () => Math.round(rng() * 10000 * 100) / 100;

    case 'select':
    case 'status': {
      const choices = typeOptions?.choices ?? [];
      if (choices.length === 0) return null;
      return () => choices[Math.floor(rng() * choices.length)].id;
    }

    case 'multiSelect': {
      const choices = typeOptions?.choices ?? [];
      if (choices.length === 0) return () => [];
      return () => {
        const count = 1 + Math.floor(rng() * Math.min(3, choices.length));
        const shuffled = [...choices].sort(() => rng() - 0.5);
        return shuffled.slice(0, count).map((c: any) => c.id);
      };
    }

    case 'date': {
      const start = new Date(2020, 0, 1).getTime();
      const range = new Date(2026, 0, 1).getTime() - start;
      return () => new Date(start + rng() * range).toISOString();
    }

    case 'checkbox':
      return () => rng() > 0.5;

    case 'url':
      return () => `https://example.com/page/${Math.floor(rng() * 100000)}`;

    case 'email':
      return () => `user${Math.floor(rng() * 100000)}@example.com`;

    default:
      return null;
  }
}

export async function seedBase(opts: SeedBaseOptions): Promise<SeededBase> {
  const { db, workspaceId, spaceId, creatorUserId, rows } = opts;
  const baseName =
    opts.name ??
    `Seed Base ${rows >= 1000 ? `${Math.round(rows / 1000)}K` : `${rows}`} rows`;

  const rng = makeRng(hashSeed(`${baseName}:${rows}`));
  const baseId = uuid7();

  await db
    .insertInto('bases')
    .values({
      id: baseId,
      name: baseName,
      space_id: spaceId,
      workspace_id: workspaceId,
      creator_id: creatorUserId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  const propertyDefs = buildPropertyDefinitions();
  let propPosition: string | null = null;
  const insertedProperties: any[] = [];

  for (const def of propertyDefs) {
    propPosition = generateJitteredKeyBetween(propPosition, null);
    insertedProperties.push({
      id: uuid7(),
      base_id: baseId,
      name: def.name,
      type: def.type,
      position: propPosition,
      type_options: def.typeOptions ?? null,
      is_primary: def.isPrimary ?? false,
      workspace_id: workspaceId,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  await db.insertInto('base_properties').values(insertedProperties).execute();

  const viewId = uuid7();
  await db
    .insertInto('base_views')
    .values({
      id: viewId,
      base_id: baseId,
      name: 'Table View 1',
      type: 'table',
      position: generateJitteredKeyBetween(null, null),
      config: {},
      workspace_id: workspaceId,
      creator_id: creatorUserId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  const byName = new Map(insertedProperties.map((p) => [p.name, p.id]));
  const propertyIds: SeededBase['propertyIds'] = {
    title: byName.get('Title')!,
    status: byName.get('Status')!,
    priority: byName.get('Priority')!,
    category: byName.get('Category')!,
    tags: byName.get('Tags')!,
    dueDate: byName.get('Due Date')!,
    estimate: byName.get('Estimate')!,
    budget: byName.get('Budget')!,
    approved: byName.get('Approved')!,
    website: byName.get('Website')!,
    contactEmail: byName.get('Contact Email')!,
    notes: byName.get('Notes')!,
    created: byName.get('Created')!,
    lastEdited: byName.get('Last Edited')!,
    text: byName.get('Title')!,
    number: byName.get('Estimate')!,
    date: byName.get('Due Date')!,
  };

  const statusProp = insertedProperties.find((p) => p.name === 'Status');
  const statusChoiceIds: string[] =
    (statusProp?.type_options?.choices ?? []).map((c: any) => c.id);

  const generators: Array<{ propertyId: string; generate: CellGenerator }> = [];
  for (const prop of insertedProperties) {
    const gen = buildCellGenerator(prop, rng);
    if (gen) {
      generators.push({ propertyId: prop.id, generate: gen });
    }
  }

  const positions: string[] = new Array(rows);
  let lastPosition: string | null = null;
  for (let i = 0; i < rows; i++) {
    lastPosition = generateJitteredKeyBetween(lastPosition, null);
    positions[i] = lastPosition;
  }

  const BATCH_SIZE = 2000;
  for (let batchStart = 0; batchStart < rows; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, rows);
    const rowsBatch: any[] = [];
    for (let i = batchStart; i < batchEnd; i++) {
      const cells: Record<string, unknown> = {};
      for (const { propertyId, generate } of generators) {
        cells[propertyId] = generate();
      }
      rowsBatch.push({
        id: uuid7(),
        base_id: baseId,
        cells,
        position: positions[i],
        creator_id: creatorUserId,
        workspace_id: workspaceId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    await db.insertInto('base_rows').values(rowsBatch).execute();
  }

  return { baseId, propertyIds, statusChoiceIds };
}

export async function deleteSeededBase(
  db: Kysely<any>,
  baseId: string,
): Promise<void> {
  await db.deleteFrom('base_rows').where('base_id', '=', baseId).execute();
  await db.deleteFrom('base_views').where('base_id', '=', baseId).execute();
  await db
    .deleteFrom('base_properties')
    .where('base_id', '=', baseId)
    .execute();
  await db.deleteFrom('bases').where('id', '=', baseId).execute();
}
