import { Kysely, sql } from 'kysely';
import type { PageTaskItem } from '../../../core/task/task-content';

type TaskOwners = {
  id: string;
  blockId: string;
  checked: boolean;
  assignmentId: string | null;
  creatorId: string | null;
  assigneeId: string | null;
};

export async function upsertPageTasks(
  db: Kysely<any>,
  page: { id: string; workspaceId: string },
  tasks: PageTaskItem[],
  creatorId: string | null,
  options: { creators?: Map<string, string>; notifyAssignments?: boolean } = {},
) {
  if (!tasks.length) return [];
  const rows = tasks.map((task) => ({
    ...task,
    creatorId: options.creators?.get(task.blockId) ?? creatorId,
  }));
  // Validate the mentioned user against the page's workspace. Deleted users
  // and references copied from another workspace leave the task unassigned.
  const result = await sql<TaskOwners>`
    insert into page_tasks (page_id, block_id, title, checked, due_date, creator_id, assignee_id, assignment_id)
    select ${page.id}::uuid, t."blockId", t.title, t.checked, t."dueDate", creator.id, assignee.id,
      case when assignee.id is not null and ${!!options.notifyAssignments} then gen_uuid_v7() end
    from jsonb_to_recordset(${JSON.stringify(rows)}::text::jsonb) as t(
      "blockId" text, title text, checked boolean, "dueDate" date, "creatorId" uuid, "assigneeId" uuid
    )
    left join users creator on creator.id = t."creatorId" and creator.workspace_id = ${page.workspaceId}
    left join users assignee on assignee.id = t."assigneeId" and assignee.workspace_id = ${page.workspaceId} and assignee.deleted_at is null and assignee.deactivated_at is null
    on conflict (page_id, block_id) do update set
      (title, checked, due_date, assignee_id) = (excluded.title, excluded.checked, excluded.due_date, excluded.assignee_id),
      assignment_id = case when page_tasks.assignee_id is distinct from excluded.assignee_id
          then excluded.assignment_id else page_tasks.assignment_id end
    where (page_tasks.title, page_tasks.checked, page_tasks.due_date, page_tasks.assignee_id)
      is distinct from (excluded.title, excluded.checked, excluded.due_date, excluded.assignee_id)
    returning page_tasks.id, page_tasks.block_id as "blockId", page_tasks.checked, page_tasks.assignment_id as "assignmentId", page_tasks.creator_id as "creatorId", page_tasks.assignee_id as "assigneeId"
  `.execute(db);
  return result.rows;
}
