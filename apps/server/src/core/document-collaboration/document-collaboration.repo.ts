import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../database/types/kysely.types';
import { TaskListDto, ReadingListDto } from './dto/collaboration.dto';

/** Stores business records; the service checks access before exposing any content. */
@Injectable()
export class DocumentCollaborationRepo {
  constructor(@InjectKysely() readonly db: KyselyDB) {}

  taskCandidates(
    workspaceId: string,
    userId: string,
    dto: TaskListDto,
    cursor?: string,
  ) {
    let q = this.db
      .selectFrom('documentTasks')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .orderBy('id', 'desc')
      .limit(50);
    if (dto.pageId) q = q.where('pageId', '=', dto.pageId);
    else
      q = q.where(
        dto.scope === 'created' ? 'creatorId' : 'assigneeId',
        '=',
        userId,
      );
    if (dto.status === 'overdue')
      q = q.where('status', '=', 'pending').where('dueAt', '<', new Date());
    else if (dto.status !== 'all')
      q = q.where(
        'status',
        '=',
        dto.status as 'pending' | 'completed' | 'cancelled',
      );
    if (cursor) q = q.where('id', '<', cursor);
    return q.execute();
  }

  readingCandidates(
    workspaceId: string,
    userId: string,
    dto: ReadingListDto,
    cursor?: string,
  ) {
    let q = this.db
      .selectFrom('readingBatches as b')
      .leftJoin('readingRecipients as r', (join) =>
        join.onRef('r.batchId', '=', 'b.id').on('r.userId', '=', userId),
      )
      .selectAll('b')
      .select('r.confirmedAt as myConfirmedAt')
      .where('b.workspaceId', '=', workspaceId)
      .orderBy('b.id', 'desc')
      .limit(50);
    if (dto.pageId) q = q.where('b.pageId', '=', dto.pageId);
    else if (dto.scope === 'created') q = q.where('b.creatorId', '=', userId);
    else q = q.where('r.userId', '=', userId);
    if (dto.status === 'pending')
      q = q
        .where('b.status', '=', 'open')
        .where('r.userId', '=', userId)
        .where('r.confirmedAt', 'is', null);
    else if (dto.status === 'confirmed')
      q = q
        .where('r.userId', '=', userId)
        .where('r.confirmedAt', 'is not', null);
    else if (dto.status !== 'all')
      q = q.where('b.status', '=', dto.status as 'open' | 'closed' | 'revoked');
    if (cursor) q = q.where('b.id', '<', cursor);
    return q.execute();
  }

  async outbox(
    trx: KyselyTransaction,
    data: {
      workspaceId: string;
      userId: string;
      actorId: string;
      pageId: string;
      type: string;
      resourceId: string;
    },
  ) {
    await trx.insertInto('collaborationOutbox').values(data).execute();
  }

  async taskSummary(task: {
    id: string;
    pageId: string | null;
    creatorId: string | null;
    assigneeId: string | null;
  }) {
    const [page, users] = await Promise.all([
      task.pageId
        ? this.db
            .selectFrom('pages')
            .innerJoin('spaces', 'spaces.id', 'pages.spaceId')
            .select([
              'pages.id',
              'pages.title',
              'pages.slugId',
              'spaces.slug as spaceSlug',
            ])
            .where('pages.id', '=', task.pageId)
            .executeTakeFirst()
        : undefined,
      this.db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('id', 'in', [task.creatorId, task.assigneeId].filter(Boolean))
        .execute(),
    ]);
    return {
      page,
      creator: users.find((u) => u.id === task.creatorId),
      assignee: users.find((u) => u.id === task.assigneeId),
    };
  }
}
