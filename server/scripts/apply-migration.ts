/**
 * Applies the initial Drizzle migration using Bun's built-in SQLite.
 * Run with: bun run scripts/apply-migration.ts
 */
import { Database } from 'bun:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const dbPath = process.env.DATABASE_PATH ?? './data/docmost.db';
const migrationsDir = join(import.meta.dir, '..', 'drizzle');

const sqlite = new Database(dbPath, { create: true });

// Enable WAL mode and other performance pragmas
sqlite.run('PRAGMA journal_mode = WAL');
sqlite.run('PRAGMA synchronous = NORMAL');
sqlite.run('PRAGMA foreign_keys = OFF'); // off during schema creation

// Create migration tracking table
sqlite.run(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at INTEGER
  )
`);

// Get already applied migrations
const applied = new Set(
  sqlite.query<{ hash: string }, []>('SELECT hash FROM __drizzle_migrations')
    .all()
    .map(r => r.hash)
);

// Read and apply pending migrations
const files = (await readdir(migrationsDir))
  .filter(f => f.endsWith('.sql'))
  .sort();

let applied_count = 0;
for (const file of files) {
  const hash = file.replace('.sql', '');
  if (applied.has(hash)) {
    console.log(`[skip] ${file} (already applied)`);
    continue;
  }

  const sql = await readFile(join(migrationsDir, file), 'utf-8');
  // Split on drizzle's statement-breakpoint marker
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(Boolean);

  console.log(`[apply] ${file} (${statements.length} statements)`);
  sqlite.transaction(() => {
    for (const stmt of statements) {
      try {
        sqlite.run(stmt);
      } catch (err) {
        console.error(`  Error in statement:\n  ${stmt.substring(0, 100)}...\n  ${err}`);
        throw err;
      }
    }
    sqlite.run(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      [hash, Date.now()]
    );
  })();

  applied_count++;
}

// Re-enable foreign keys
sqlite.run('PRAGMA foreign_keys = ON');
sqlite.close();

if (applied_count > 0) {
  console.log(`\n✓ Applied ${applied_count} migration(s) to ${dbPath}`);
} else {
  console.log(`\n✓ Database is up to date (${dbPath})`);
}
