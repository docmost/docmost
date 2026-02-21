import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const dbPath = Bun.env.DATABASE_PATH || './data/docmost.db';

// Ensure the data directory exists
const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
if (dir) {
  await Bun.$`mkdir -p ${dir}`.quiet().nothrow();
}

const sqlite = new Database(dbPath, { create: true });

// Performance and correctness pragmas
sqlite.run('PRAGMA journal_mode = WAL');
sqlite.run('PRAGMA synchronous = NORMAL');
sqlite.run('PRAGMA cache_size = -64000');    // 64MB page cache
sqlite.run('PRAGMA temp_store = MEMORY');
sqlite.run('PRAGMA foreign_keys = ON');
sqlite.run('PRAGMA busy_timeout = 5000');
sqlite.run('PRAGMA mmap_size = 30000000000');

// Register custom unaccent function for search (replaces PostgreSQL f_unaccent)
sqlite.function('unaccent', (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
});

export const db = drizzle(sqlite, { schema });
export { sqlite };
