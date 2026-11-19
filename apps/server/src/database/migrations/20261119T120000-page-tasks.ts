import { Kysely, sql } from 'kysely';
import { extractPageTasks } from '../../core/task/task-content';
import { upsertPageTasks } from '../repos/page-task/upsert-page-tasks';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_tasks')
    .addColumn('id', 'uuid', (c) =>
      c.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (c) =>
      c.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('block_id', 'varchar', (c) => c.notNull())
    .addColumn('creator_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('assignee_id', 'uuid', (c) =>
      c.references('users.id').onDelete('set null'),
    )
    .addColumn('assignment_id', 'uuid')
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('checked', 'boolean', (c) => c.notNull())
    .addColumn('due_date', 'date')
    .addUniqueConstraint('page_tasks_page_block_unique', [
      'page_id',
      'block_id',
    ])
    .execute();
  for (const column of ['creator_id', 'assignee_id']) {
    await db.schema
      .createIndex(`page_tasks_${column}_idx`)
      .on('page_tasks')
      .columns([column, 'checked', 'id'])
      .where(column, 'is not', null)
      .execute();
  }

  // Historical task items recorded no author. Index their assignees without
  // attributing their creation to whoever last edited or first opens the page.
  let after: string | undefined;
  for (;;) {
    const { rows } = await sql<{
      id: string;
      workspaceId: string;
      content: unknown;
    }>`
      select id, workspace_id as "workspaceId", content from pages
      where content @? 'strict $.** ? (@.type == "taskItem")'
      ${after ? sql`and id > ${after}` : sql``}
      order by id limit 100 for update
    `.execute(db);
    if (!rows.length) break;
    for (const page of rows) {
      await upsertPageTasks(db, page, extractPageTasks(page.content), null);
    }
    after = rows[rows.length - 1].id;
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_tasks').execute();
}
