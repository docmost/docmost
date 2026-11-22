import { Expression, ExpressionBuilder, SqlBool, sql } from 'kysely';
import { validate as isUuid } from 'uuid';
import type { DB } from '@docmost/db/types/db';
import type { RecentlyUpdatedDto } from '../../../core/page/dto/recently-updated.dto';
import { normalizeLabelName } from '../../../core/label/utils';

type Builder = ExpressionBuilder<DB, 'pages' | 'spaces'>;

function matchSpaces(
  eb: Builder,
  options: RecentlyUpdatedDto,
  viewerId: string,
) {
  function resolve(value: string): Expression<SqlBool> | undefined {
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
  }

  const { spaces, excludeSpaces, spaceMatch } = options;
  const included = spaces.map(resolve);
  const excluded = excludeSpaces.map(resolve);
  // An unknown space on either side leaves the feed empty until it can be mapped.
  if (
    !included.every((value) => value !== undefined) ||
    !excluded.every((value) => value !== undefined)
  )
    return sql<SqlBool>`false`;

  const conditions: Expression<SqlBool>[] = [];
  if (included.length)
    conditions.push(spaceMatch === 'all' ? eb.and(included) : eb.or(included));
  if (excluded.length) conditions.push(eb.not(eb.or(excluded)));
  return eb.and(conditions);
}

export function recentlyUpdatedFilter(
  eb: Builder,
  options: RecentlyUpdatedDto,
  viewerId: string,
) {
  const labels = [...new Set(options.labels.map(normalizeLabelName))];
  const labeledPages = eb
    .selectFrom('pageLabels')
    .innerJoin('labels', 'labels.id', 'pageLabels.labelId')
    .select('pageLabels.pageId')
    .whereRef('pageLabels.pageId', '=', 'pages.id')
    .whereRef('labels.workspaceId', '=', 'pages.workspaceId')
    .where('labels.type', '=', 'page');

  const conditions: Expression<SqlBool>[] = [
    matchSpaces(eb, options, viewerId),
  ];
  if (labels.length) {
    let included = labeledPages.where('labels.name', 'in', labels);
    if (options.match === 'all' && labels.length > 1) {
      included = included
        .groupBy('pageLabels.pageId')
        .having((eb) => eb.fn.count('labels.id'), '=', labels.length);
    }
    conditions.push(eb.exists(included));
  }
  if (options.excludeLabels.length) {
    conditions.push(
      eb.not(
        eb.exists(
          labeledPages.where(
            'labels.name',
            'in',
            options.excludeLabels.map(normalizeLabelName),
          ),
        ),
      ),
    );
  }
  return eb.and(conditions);
}
