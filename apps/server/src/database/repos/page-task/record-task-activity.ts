import { sql } from 'kysely';
import type { KyselyTransaction } from '../../types/kysely.types';

export interface TaskActivityChange {
  userId: string;
  taskId: string;
  assignmentId?: string;
  checkedBefore?: boolean;
  checkedAfter?: boolean;
}

// One collecting batch per recipient, across all pages. Updating the open row takes
// the same lock as sealing it. A concurrent edit therefore lands in exactly one batch.
export async function recordTaskActivity(
  trx: KyselyTransaction,
  changes: TaskActivityChange[],
) {
  if (!changes.length) return;
  await sql`
    with input as (
      select * from jsonb_to_recordset(${JSON.stringify(changes)}::text::jsonb)
      as i("userId" uuid, "taskId" uuid, "assignmentId" uuid, "checkedBefore" boolean, "checkedAfter" boolean)
    ), batches as (
      insert into task_notification_batches(user_id)
      select distinct "userId" from input order by "userId"
      on conflict(user_id) where sealed_at is null do update set user_id = excluded.user_id
      returning id, user_id
    )
    insert into task_notification_items(batch_id, task_id, assignment_id, checked_before, checked_after)
    select b.id, i."taskId", i."assignmentId", i."checkedBefore", i."checkedAfter"
    from input i join batches b on b.user_id = i."userId" order by b.id, i."taskId"
    on conflict(batch_id, task_id) do update set
      assignment_id = coalesce(excluded.assignment_id, task_notification_items.assignment_id),
      checked_before = coalesce(task_notification_items.checked_before, excluded.checked_before),
      checked_after = coalesce(excluded.checked_after, task_notification_items.checked_after)
  `.execute(trx);
}

export async function clearOwnTaskChecks(
  trx: KyselyTransaction,
  actors: { userId: string; taskId: string }[],
) {
  if (!actors.length) return;
  await sql`
    update task_notification_items i set checked_before = null, checked_after = null
    from task_notification_batches b,
      jsonb_to_recordset(${JSON.stringify(actors)}::text::jsonb) as a("userId" uuid, "taskId" uuid)
    where i.batch_id = b.id and b.sealed_at is null and b.user_id = a."userId"
      and i.task_id = a."taskId" and i.checked_before is not null
  `.execute(trx);
}
