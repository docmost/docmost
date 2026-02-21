import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { generateUUIDv7 } from '../../lib/uuid';

// Persistent job queue for critical background tasks (email, etc.)
export const jobs = sqliteTable('_jobs', {
  id: text('id').primaryKey().$defaultFn(() => generateUUIDv7()),
  name: text('name').notNull(),
  payload: text('payload', { mode: 'json' }),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  errorMessage: text('error_message'),
  runAt: text('run_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('jobs_status_idx').on(table.status),
  index('jobs_name_idx').on(table.name),
  index('jobs_run_at_idx').on(table.runAt),
]);
