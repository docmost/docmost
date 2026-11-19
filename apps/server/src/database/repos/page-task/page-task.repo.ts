import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { isDeepStrictEqual } from 'node:util';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { Feature } from '../../../common/features';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import {
  extractPageTasks,
  PageTaskItem,
} from '../../../core/task/task-content';
import { upsertPageTasks } from './upsert-page-tasks';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { SpaceMemberRepo } from '../space/space-member.repo';
import { PagePermissionRepo } from '../page/page-permission.repo';

@Injectable()
export class PageTaskRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly spaces: SpaceMemberRepo,
    private readonly permissions: PagePermissionRepo,
    private readonly licenses: LicenseCheckService,
  ) {}

  // Shared by the personal list, completion, inbox and delivery workers.
  visibleTo(userId: string) {
    return this.db
      .selectFrom('pageTasks')
      .innerJoin('pages', 'pages.id', 'pageTasks.pageId')
      .where('pages.deletedAt', 'is', null)
      .where(
        'pages.spaceId',
        'in',
        this.spaces.getUserSpaceIdsQuery(userId, { excludeArchived: true }),
      )
      .where(this.permissions.canUserAccessPageExpression(userId));
  }

  async ownersInSubtrees(pageIds: string[]): Promise<string[]> {
    const { rows } = await sql<{ userId: string }>`
      with recursive subtree(id) as (
        select id from pages where id = any(${pageIds}::uuid[])
        union
        select p.id from pages p join subtree s on s.id = p.parent_page_id
      )
      select distinct owner.id as "userId" from page_tasks t
      join subtree s on s.id = t.page_id
      cross join lateral (values (t.creator_id), (t.assignee_id)) owner(id)
      where owner.id is not null
    `.execute(this.db);
    return rows.map((row) => row.userId);
  }

  findPersonal(taskId: string, userId: string, workspaceId: string) {
    return this.visibleTo(userId)
      .where('pages.workspaceId', '=', workspaceId)
      .where('pageTasks.id', '=', taskId)
      .where((eb) =>
        eb.or([
          eb('pageTasks.creatorId', '=', userId),
          eb('pageTasks.assigneeId', '=', userId),
        ]),
      )
      .select([
        'pageTasks.pageId',
        'pages.spaceId',
        'pageTasks.blockId',
        'pageTasks.creatorId',
        'pageTasks.checked',
      ])
      .executeTakeFirst();
  }

  async editablePages(
    tasks: { pageId: string; spaceId: string }[],
    userId: string,
  ) {
    const spaceIds = [...new Set(tasks.map((t) => t.spaceId))];
    const roles = await this.spaces.getUserRolesForSpaces(userId, spaceIds);
    const memberships = new Set(roles.map((r) => r.spaceId));
    const pageIds = [
      ...new Set(
        tasks.filter((t) => memberships.has(t.spaceId)).map((t) => t.pageId),
      ),
    ];
    const writableSpaces = roles
      .filter((r) => r.role === SpaceRole.ADMIN || r.role === SpaceRole.WRITER)
      .map((r) => r.spaceId);
    const pages = await this.permissions.filterAccessiblePageIdsWithPermissions(
      pageIds,
      userId,
      writableSpaces,
    );
    return new Set(pages.filter((p) => p.canEdit).map((p) => p.id));
  }

  private async canNotify(db: KyselyDB, workspaceId: string) {
    const workspace = await db
      .selectFrom('workspaces')
      .select(['licenseKey', 'plan'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();
    return (
      !!workspace &&
      this.licenses.hasFeature(
        workspace.licenseKey,
        Feature.TASKS,
        workspace.plan,
      )
    );
  }

  async indexNewPage(
    db: KyselyDB,
    page: {
      id: string;
      workspaceId: string;
      creatorId?: string;
      content?: unknown;
    },
    tasks = extractPageTasks(page.content),
  ) {
    if (!tasks.length) return;
    const notifyAssignments =
      tasks.some((t) => t.assigneeId) &&
      (await this.canNotify(db, page.workspaceId));
    await upsertPageTasks(db, page, tasks, page.creatorId, {
      notifyAssignments,
    });
  }

  async sync(
    trx: KyselyTransaction,
    page: { id: string; workspaceId: string; content: unknown },
    userId: string,
    creators: Map<string, string>,
    tasks: PageTaskItem[],
  ): Promise<string[]> {
    const previous = new Map(
      extractPageTasks(page.content).map((task) => [task.blockId, task]),
    );
    let hasNewAssignment = false;
    const changed = tasks.filter((task) => {
      const old = previous.get(task.blockId);
      previous.delete(task.blockId);
      if (task.assigneeId && task.assigneeId !== old?.assigneeId)
        hasNewAssignment = true;
      return !isDeepStrictEqual(old, task);
    });
    const removed = [...previous.keys()];
    if (!changed.length && !removed.length) return [];

    const affected = removed.concat(changed.map((task) => task.blockId));
    const oldOwners = await trx
      .selectFrom('pageTasks')
      .select(['creatorId', 'assigneeId'])
      .where('pageId', '=', page.id)
      .where(sql<boolean>`block_id = any(${affected}::text[])`)
      .execute();
    if (removed.length) {
      await trx
        .deleteFrom('pageTasks')
        .where('pageId', '=', page.id)
        .where(sql<boolean>`block_id = any(${removed}::text[])`)
        .execute();
    }
    const notifyAssignments =
      hasNewAssignment && (await this.canNotify(trx, page.workspaceId));
    const newOwners = await upsertPageTasks(trx, page, changed, userId, {
      creators,
      notifyAssignments,
    });
    return [
      ...new Set(
        [...oldOwners, ...newOwners]
          .flatMap((task) => [task.creatorId, task.assigneeId])
          .filter(Boolean),
      ),
    ];
  }
}
