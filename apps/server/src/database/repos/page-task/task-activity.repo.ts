import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { PageTaskRepo } from './page-task.repo';

export type TaskActivityKind = 'assigned' | 'completed' | 'reopened';
type ActivityFilter = { assignments: boolean; checks: boolean };
const allActivity: ActivityFilter = { assignments: true, checks: true };

@Injectable()
export class TaskActivityRepo {
  constructor(private readonly tasks: PageTaskRepo) {}

  // Resolve titles, links and counts from the same set of currently readable
  // tasks. A group can span several pages with different access restrictions.
  visibleItems(userId: string, filter: ActivityFilter = allActivity) {
    const assignment = sql<boolean>`${filter.assignments} and activity.assignment_id = page_tasks.assignment_id and page_tasks.assignee_id = ${userId}`;
    const check = sql<boolean>`${filter.checks} and activity.checked_before <> activity.checked_after
      and (page_tasks.creator_id = ${userId} or page_tasks.assignee_id = ${userId})`;
    return this.tasks
      .visibleTo(userId)
      .innerJoin(
        'taskNotificationItems as activity',
        'activity.taskId',
        'pageTasks.id',
      )
      .innerJoin(
        'taskNotificationBatches as batch',
        'batch.id',
        'activity.batchId',
      )
      .innerJoin('users as recipient', 'recipient.id', 'batch.userId')
      .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
      .where('recipient.id', '=', userId)
      .whereRef('recipient.workspaceId', '=', 'pages.workspaceId')
      .where('recipient.deletedAt', 'is', null)
      .where('recipient.deactivatedAt', 'is', null)
      .where((eb) => eb.or([assignment, check]))
      .select([
        'pageTasks.id as taskId',
        'pageTasks.blockId',
        'pageTasks.title',
        'pages.title as pageTitle',
        'pages.slugId as pageSlugId',
        'spaces.slug as spaceSlug',
        'spaces.name as spaceName',
      ])
      .select([
        sql<TaskActivityKind>`case when ${assignment} then 'assigned' when activity.checked_after then 'completed' else 'reopened' end`.as(
          'kind',
        ),
        sql<boolean>`case when ${assignment} then page_tasks.checked else activity.checked_after end`.as(
          'checked',
        ),
        sql<string | null>`to_char(page_tasks.due_date, 'YYYY-MM-DD')`.as(
          'dueDate',
        ),
      ]);
  }

  previewQuery(userId: string, filter?: ActivityFilter) {
    return this.visibleItems(userId, filter)
      .select(sql<number>`count(*) over ()::integer`.as('count'))
      .orderBy('pageTasks.id', 'asc');
  }

  preview(
    userId: string,
    batchId: string,
    filter: ActivityFilter = allActivity,
    limit = 5,
  ) {
    return this.previewQuery(userId, filter)
      .where('batch.id', '=', batchId)
      .limit(limit)
      .execute();
  }
}
