import { decodeRecentlyUpdatedLabel } from '@docmost/editor-ext';
import { Expression, ExpressionBuilder, SqlBool, sql } from 'kysely';
import { validate as isUuid } from 'uuid';
import type { DB } from '@docmost/db/types/db';
import type { RecentlyUpdatedDto } from '../../../core/page/dto/recently-updated.dto';
import { normalizeLabelName } from '../../../core/label/utils';

type Builder = ExpressionBuilder<DB, 'pages' | 'spaces'>;

function matchTokens(
  eb: Builder,
  tokens: string[],
  resolve: (value: string) => Expression<SqlBool> | undefined,
) {
  const required: Expression<SqlBool>[] = [];
  const included: Expression<SqlBool>[] = [];
  const excluded: Expression<SqlBool>[] = [];
  for (const token of tokens) {
    const signed = token.trim();
    const sign = signed[0];
    const value = sign === '+' || sign === '-' ? signed.slice(1) : signed;
    const match = value && !value.startsWith('?') && resolve(value);
    if (!match) return sql<SqlBool>`false`;
    if (sign === '-') excluded.push(eb.not(match));
    else if (sign === '+') required.push(match);
    else included.push(match);
  }
  if (!required.length && included.length) required.push(eb.or(included));
  return eb.and([...required, ...excluded]);
}

export function recentlyUpdatedFilter(
  eb: Builder,
  options: RecentlyUpdatedDto,
  viewerId: string,
) {
  const spaces = options.spaces.length ? options.spaces : ['@self'];
  return eb.and([
    matchTokens(eb, spaces, (value) => {
      switch (value.toLowerCase()) {
        case '@all':
        case '*':
          return sql<SqlBool>`true`;
        case '@self':
          return eb('pages.spaceId', '=', options.spaceId);
        case '@personal':
        case '@global':
          return eb(
            'spaces.isPersonal',
            '=',
            value.toLowerCase() === '@personal',
          );
        case '@favorite':
        case '@favourite':
          return eb.exists(
            eb
              .selectFrom('favorites')
              .select('favorites.id')
              .whereRef('favorites.spaceId', '=', 'pages.spaceId')
              .where('favorites.type', '=', 'space')
              .where('favorites.userId', '=', viewerId),
          );
        default:
          return isUuid(value) ? eb('pages.spaceId', '=', value) : undefined;
      }
    }),
    matchTokens(eb, options.labels, (value) => {
      const name = normalizeLabelName(decodeRecentlyUpdatedLabel(value));
      return eb.exists(
        eb
          .selectFrom('pageLabels')
          .innerJoin('labels', 'labels.id', 'pageLabels.labelId')
          .select('pageLabels.id')
          .whereRef('pageLabels.pageId', '=', 'pages.id')
          .whereRef('labels.workspaceId', '=', 'pages.workspaceId')
          .where('labels.type', '=', 'page')
          .where('labels.name', '=', name),
      );
    }),
  ]);
}
