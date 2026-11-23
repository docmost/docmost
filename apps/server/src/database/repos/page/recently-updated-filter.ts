import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import type { DB } from '@docmost/db/types/db';
import type { RecentlyUpdatedDto } from '../../../core/page/dto/recently-updated.dto';
import { normalizeLabelName } from '../../../core/label/utils';

export function recentlyUpdatedFilter(
  eb: ExpressionBuilder<DB, 'pages'>,
  options: RecentlyUpdatedDto,
) {
  const conditions: Expression<SqlBool>[] = [];
  if (options.scope === 'current') {
    conditions.push(eb('pages.spaceId', '=', options.spaceId));
  }
  if (options.scope === 'spaces') {
    conditions.push(eb('pages.spaceId', 'in', options.spaceIds));
  }
  if (options.excludeSpaceIds.length) {
    conditions.push(eb('pages.spaceId', 'not in', options.excludeSpaceIds));
  }

  const labels = [...new Set(options.labels.map(normalizeLabelName))];
  const labeledPages = eb
    .selectFrom('pageLabels')
    .innerJoin('labels', 'labels.id', 'pageLabels.labelId')
    .select('pageLabels.pageId')
    .whereRef('pageLabels.pageId', '=', 'pages.id')
    .whereRef('labels.workspaceId', '=', 'pages.workspaceId')
    .where('labels.type', '=', 'page');

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
