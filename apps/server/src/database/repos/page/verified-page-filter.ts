import { sql } from 'kysely';
import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import type { DB } from '@docmost/db/types/db';

// keep in step with the status rules behind the page verification badge
export function verifiedPageFilter(
  eb: ExpressionBuilder<DB, 'pages'>,
): Expression<SqlBool> {
  return eb.exists(
    eb
      .selectFrom('pageVerifications')
      .select('pageVerifications.id')
      .whereRef('pageVerifications.pageId', '=', 'pages.id')
      .whereRef('pageVerifications.workspaceId', '=', 'pages.workspaceId')
      .where((eb) =>
        eb.or([
          eb.and([
            eb('pageVerifications.type', '=', 'qms'),
            eb('pageVerifications.status', '=', 'approved'),
          ]),
          eb.and([
            eb('pageVerifications.type', '<>', 'qms'),
            eb('pageVerifications.invalidatedAt', 'is', null),
            eb.or([
              eb('pageVerifications.expiresAt', 'is', null),
              eb('pageVerifications.expiresAt', '>', sql<Date>`now()`),
            ]),
          ]),
        ]),
      ),
  );
}
