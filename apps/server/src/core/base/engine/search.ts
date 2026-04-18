import { Expression, ExpressionBuilder, sql, SqlBool } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { SearchSpec } from './schema.zod';

type Eb = ExpressionBuilder<DB, 'baseRows'>;

/*
 * `search_text` and `search_tsv` are maintained by the base_rows search
 * trigger installed in the bases-hardening migration. Both columns are
 * indexed — pg_trgm GIN for ILIKE and standard GIN for tsvector.
 */

export function buildSearch(eb: Eb, spec: SearchSpec): Expression<SqlBool> {
  const q = spec.query.trim();
  if (!q) return sql<SqlBool>`TRUE`;

  if (spec.mode === 'fts') {
    // Accent-insensitive match via f_unaccent (same helper the search
    // trigger uses when populating search_tsv / search_text).
    return sql<SqlBool>`search_tsv @@ plainto_tsquery('english', f_unaccent(${q}))`;
  }

  // trigram ILIKE mode (default). escape %/_/\\ in user input so wildcards
  // can't be injected.
  const escaped = q.replace(/[%_\\]/g, '\\$&');
  return sql<SqlBool>`search_text ILIKE ${'%' + escaped + '%'}`;
}
