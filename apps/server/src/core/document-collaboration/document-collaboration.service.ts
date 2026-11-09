import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Page, User } from '../../database/types/entity.types';
import { PageRepo } from '../../database/repos/page/page.repo';
import { UserRepo } from '../../database/repos/user/user.repo';
import { PageAccessService } from '../page/page-access/page-access.service';
import { DocumentCollaborationRepo } from './document-collaboration.repo';
import {
  CollaborationMembersDto,
  CreateDocumentTaskDto,
  UpdateDocumentTaskDto,
  TaskListDto,
  CreateReadingBatchDto,
  ReadingListDto,
} from './dto/collaboration.dto';

/** Document-linked tasks and explicit acknowledgement of immutable published content. */
@Injectable()
export class DocumentCollaborationService {
  constructor(
    private readonly repo: DocumentCollaborationRepo,
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
    private readonly access: PageAccessService,
  ) {}

  private async page(
    pageId: string | null,
    user: User,
    workspaceId: string,
    edit = false,
  ): Promise<Page> {
    if (!pageId) throw new NotFoundException('源文档不存在或已删除');
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.workspaceId !== workspaceId || page.deletedAt)
      throw new NotFoundException('源文档不存在或已删除');
    try {
      if (edit) await this.access.validateCanEdit(page, user);
      else await this.access.validateCanView(page, user, { skipCache: true });
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw new ForbiddenException('没有源文档的相应访问权限');
      }
      throw error;
    }
    return page;
  }

  private async recipient(userId: string, page: Page, workspaceId: string) {
    if (!userId) throw new BadRequestException('请指定有效成员');
    const user = await this.userRepo.findById(userId, workspaceId);
    if (!user || user.deletedAt || user.deactivatedAt)
      throw new BadRequestException('负责人或接收人不是当前工作区的有效成员');
    try {
      await this.access.validateCanView(page, user, { skipCache: true });
    } catch (error) {
      if (!(error instanceof ForbiddenException || error instanceof NotFoundException)) throw error;
      throw new BadRequestException(
        '负责人或接收人没有源文档读取权限；指派不会自动授权',
      );
    }
    return user;
  }

  async members(dto: CollaborationMembersDto, user: User, workspaceId: string) {
    const page = await this.page(dto.pageId, user, workspaceId, true);
    let q = this.repo.db
      .selectFrom('users')
      .select(['id', 'name', 'email'])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .orderBy('id')
      .limit(50);
    if (dto.cursor) q = q.where('id', '>', dto.cursor);
    if (dto.query)
      q = q.where((eb) =>
        eb.or([
          eb('name', 'ilike', `%${dto.query}%`),
          eb('email', 'ilike', `%${dto.query}%`),
        ]),
      );
    const candidates = await q.execute();
    const items = [];
    for (const candidate of candidates) {
      try {
        await this.recipient(candidate.id, page, workspaceId);
        items.push(candidate);
      } catch (e) {
        if (!(e instanceof BadRequestException)) throw e;
      }
    }
    return {
      items,
      nextCursor:
        candidates.length === 50 ? candidates[candidates.length - 1].id : null,
    };
  }

  async createTask(
    dto: CreateDocumentTaskDto,
    user: User,
    workspaceId: string,
  ) {
    const page = await this.page(dto.pageId, user, workspaceId, true);
    await this.recipient(dto.assigneeId, page, workspaceId);
    return this.repo.db.transaction().execute(async (trx) => {
      const task = await trx
        .insertInto('documentTasks')
        .values({
          workspaceId,
          pageId: page.id,
          creatorId: user.id,
          assigneeId: dto.assigneeId,
          title: dto.title,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.repo.outbox(trx, {
        workspaceId,
        userId: dto.assigneeId,
        actorId: user.id,
        pageId: page.id,
        type: 'document_task.assigned',
        resourceId: task.id,
      });
      return task;
    });
  }

  async updateTask(
    dto: UpdateDocumentTaskDto,
    user: User,
    workspaceId: string,
  ) {
    if (dto.title === null || dto.assigneeId === null)
      throw new BadRequestException('标题和负责人不能为空');
    return this.repo.db.transaction().execute(async (trx) => {
      const task = await trx
        .selectFrom('documentTasks')
        .selectAll()
        .where('id', '=', dto.taskId)
        .where('workspaceId', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst();
      if (!task) throw new NotFoundException('待办不存在');
      const page = await this.page(task.pageId, user, workspaceId, true);
      if (task.creatorId !== user.id)
        throw new ForbiddenException('仅创建者可以修改待办');
      if (task.status !== 'pending')
        throw new ConflictException('已完成或已取消的待办不可修改');
      const assigneeId = dto.assigneeId ?? task.assigneeId;
      await this.recipient(assigneeId, page, workspaceId);
      const updated = await trx
        .updateTable('documentTasks')
        .set({
          title: dto.title ?? task.title,
          assigneeId,
          dueAt:
            dto.dueAt === undefined
              ? task.dueAt
              : dto.dueAt
                ? new Date(dto.dueAt)
                : null,
          updatedAt: new Date(),
        })
        .where('id', '=', task.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (assigneeId !== task.assigneeId)
        await this.repo.outbox(trx, {
          workspaceId,
          userId: assigneeId,
          actorId: user.id,
          pageId: page.id,
          type: 'document_task.assigned',
          resourceId: task.id,
        });
      return updated;
    });
  }

  async finishTask(
    taskId: string,
    user: User,
    workspaceId: string,
    cancel = false,
  ) {
    return this.repo.db.transaction().execute(async (trx) => {
      const task = await trx
        .selectFrom('documentTasks')
        .selectAll()
        .where('id', '=', taskId)
        .where('workspaceId', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst();
      if (!task) throw new NotFoundException('待办不存在');
      await this.page(task.pageId, user, workspaceId, cancel);
      if ((cancel ? task.creatorId : task.assigneeId) !== user.id)
        throw new ForbiddenException(
          cancel ? '仅创建者可以取消' : '仅当前负责人可以完成',
        );
      const target = cancel ? 'cancelled' : 'completed';
      if (task.status === target) return task;
      if (task.status !== 'pending')
        throw new ConflictException('待办已结束，不能改变状态');
      return trx
        .updateTable('documentTasks')
        .set({
          status: target,
          completedAt: cancel ? null : new Date(),
          updatedAt: new Date(),
        })
        .where('id', '=', task.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  // Scan until a visible page is filled. An inaccessible candidate must not end pagination.
  private async visibleList<T extends { id: string; pageId: string | null }>(
    load: (cursor?: string) => Promise<T[]>,
    user: User,
    workspaceId: string,
    cursor: string | undefined,
    limit: number,
    map: (item: T, page: Page) => Promise<any>,
  ) {
    const items = [];
    let last = cursor,
      scanned = 0,
      hasMore = true;
    while (items.length < limit && scanned < 500) {
      const rows = await load(last);
      if (!rows.length) {
        hasMore = false;
        break;
      }
      let consumed = 0;
      for (const row of rows) {
        last = row.id;
        scanned++;
        consumed++;
        try {
          const page = await this.page(row.pageId, user, workspaceId);
          const result = await map(row, page);
          if (result) items.push(result);
        } catch (error) {
          if (
            !(
              error instanceof ForbiddenException ||
              error instanceof NotFoundException
            )
          )
            throw error;
        }
        if (items.length === limit || scanned === 500) break;
      }
      hasMore = consumed < rows.length || rows.length === 50;
      if (!hasMore) break;
    }
    return { items, nextCursor: hasMore ? last : null, hasMore };
  }

  async listTasks(dto: TaskListDto, user: User, workspaceId: string) {
    if (dto.pageId) await this.page(dto.pageId, user, workspaceId);
    return this.visibleList(
      (c) => this.repo.taskCandidates(workspaceId, user.id, dto, c),
      user,
      workspaceId,
      dto.cursor,
      dto.limit,
      async (task, page) => {
        let canManage = false;
        if (task.creatorId === user.id) {
          try {
            await this.access.validateCanEdit(page, user);
            canManage = true;
          } catch (e) {
            if (!(e instanceof ForbiddenException)) throw e;
          }
        }
        return {
          ...task,
          ...(await this.repo.taskSummary(task)),
          canManage,
          canComplete: task.assigneeId === user.id && task.status === 'pending',
          overdue:
            task.status === 'pending' &&
            !!task.dueAt &&
            new Date(task.dueAt).getTime() < Date.now(),
        };
      },
    );
  }

  private snapshot(
    page: Pick<Page, 'title' | 'content' | 'textContent' | 'updatedAt'>,
  ) {
    const content = page.content ?? { type: 'doc', content: [] };
    const title = page.title || '无标题文档';
    const hash = createHash('sha256')
      .update(JSON.stringify({ title, content }))
      .digest('hex');
    return {
      title,
      content,
      textContent: page.textContent || '',
      contentHash: hash,
      sourceUpdatedAt: page.updatedAt,
    };
  }

  async preview(pageId: string, user: User, workspaceId: string) {
    const page = await this.page(pageId, user, workspaceId, true);
    const saved = await this.pageRepo.findById(page.id, {
      includeContent: true,
      includeTextContent: true,
    });
    return this.snapshot(saved);
  }

  async createReading(
    dto: CreateReadingBatchDto,
    user: User,
    workspaceId: string,
  ) {
    const page = await this.page(dto.pageId, user, workspaceId, true);
    const recipients: User[] = [];
    for (const id of dto.recipientIds)
      recipients.push(await this.recipient(id, page, workspaceId));
    return this.repo.db.transaction().execute(async (trx) => {
      const saved = await trx
        .selectFrom('pages')
        .selectAll()
        .where('id', '=', page.id)
        .where('deletedAt', 'is', null)
        .forShare()
        .executeTakeFirst();
      if (!saved) throw new NotFoundException('源文档不存在');
      const snapshot = this.snapshot(saved as Page);
      if (snapshot.contentHash !== dto.expectedHash)
        throw new ConflictException('文档内容已变化，请刷新预览后再发布');
      const batch = await trx
        .insertInto('readingBatches')
        .values({
          workspaceId,
          pageId: page.id,
          creatorId: user.id,
          title: dto.title,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('readingSnapshots')
        .values({
          ...snapshot,
          batchId: batch.id,
          content: snapshot.content,
        })
        .execute();
      await trx
        .insertInto('readingRecipients')
        .values(
          recipients.map((member) => ({
            batchId: batch.id,
            userId: member.id,
            recipientName: member.name || '未命名成员',
          })),
        )
        .execute();
      for (const id of dto.recipientIds)
        await this.repo.outbox(trx, {
          workspaceId,
          userId: id,
          actorId: user.id,
          pageId: page.id,
          type: 'reading_confirmation.requested',
          resourceId: batch.id,
        });
      return batch;
    });
  }

  async listReading(dto: ReadingListDto, user: User, workspaceId: string) {
    if (dto.pageId) await this.page(dto.pageId, user, workspaceId);
    return this.visibleList(
      (c) => this.repo.readingCandidates(workspaceId, user.id, dto, c),
      user,
      workspaceId,
      dto.cursor,
      dto.limit,
      async (batch) => {
        // A page reader cannot enumerate batches addressed only to other readers.
        if (batch.creatorId !== user.id) {
          const recipient = await this.repo.db
            .selectFrom('readingRecipients')
            .select('userId')
            .where('batchId', '=', batch.id)
            .where('userId', '=', user.id)
            .executeTakeFirst();
          if (!recipient) return null;
        }
        const info = await this.readingInfo(batch.id, user, workspaceId, false);
        return { ...batch, ...info };
      },
    );
  }

  async readingInfo(
    batchId: string,
    user: User,
    workspaceId: string,
    includeSnapshot = true,
  ) {
    const batch = await this.repo.db
      .selectFrom('readingBatches')
      .selectAll()
      .where('id', '=', batchId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    if (!batch) throw new NotFoundException('确认批次不存在');
    const page = await this.page(batch.pageId, user, workspaceId);
    const own = await this.repo.db
      .selectFrom('readingRecipients')
      .selectAll()
      .where('batchId', '=', batch.id)
      .where('userId', '=', user.id)
      .executeTakeFirst();
    let canManage = false;
    if (batch.creatorId === user.id) {
      try {
        await this.access.validateCanEdit(page, user);
        canManage = true;
      } catch (e) {
        if (!(e instanceof ForbiddenException)) throw e;
      }
    }
    if (!canManage && !own)
      throw new ForbiddenException('仅接收人或有编辑权限的发起人可查看');
    const recipients = canManage
      ? await this.repo.db
          .selectFrom('readingRecipients as r')
          .select([
            'r.id',
            'r.userId',
            'r.recipientName as name',
            'r.confirmedAt',
          ])
          .where('r.batchId', '=', batch.id)
          .orderBy('r.recipientName')
          .execute()
      : undefined;
    const snapshot = includeSnapshot
      ? await this.repo.db
          .selectFrom('readingSnapshots')
          .selectAll()
          .where('batchId', '=', batch.id)
          .executeTakeFirstOrThrow()
      : undefined;
    const source = await this.repo.taskSummary({
      id: batch.id,
      pageId: batch.pageId,
      creatorId: batch.creatorId,
      assigneeId: null,
    });
    return {
      ...batch,
      page: source.page,
      creator: source.creator,
      snapshot,
      recipients,
      canManage,
      isRecipient: !!own,
      myConfirmedAt: own?.confirmedAt ?? null,
      total: recipients?.length,
      confirmed: recipients?.filter((r) => r.confirmedAt).length,
    };
  }

  async confirmReading(
    batchId: string,
    acknowledged: boolean,
    user: User,
    workspaceId: string,
  ) {
    if (acknowledged !== true)
      throw new BadRequestException('请先勾选已阅读并确认本批次固定内容');
    return this.repo.db.transaction().execute(async (trx) => {
      // The same lock is used by closing/revocation, so no late confirmation can slip through.
      const batch = await trx
        .selectFrom('readingBatches')
        .selectAll()
        .where('id', '=', batchId)
        .where('workspaceId', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst();
      if (!batch) throw new NotFoundException('确认批次不存在');
      await this.page(batch.pageId, user, workspaceId);
      const own = await trx
        .selectFrom('readingRecipients')
        .selectAll()
        .where('batchId', '=', batch.id)
        .where('userId', '=', user.id)
        .executeTakeFirst();
      if (!own) throw new ForbiddenException('当前用户不在接收名单中');
      if (own.confirmedAt) return own;
      if (batch.status !== 'open')
        throw new ConflictException('本批次已结束或已撤销');
      return trx
        .updateTable('readingRecipients')
        .set({ confirmedAt: new Date() })
        .where('batchId', '=', batch.id)
        .where('userId', '=', user.id)
        .where('confirmedAt', 'is', null)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async closeReading(
    batchId: string,
    user: User,
    workspaceId: string,
    revoke = false,
  ) {
    return this.repo.db.transaction().execute(async (trx) => {
      const batch = await trx
        .selectFrom('readingBatches')
        .selectAll()
        .where('id', '=', batchId)
        .where('workspaceId', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst();
      if (!batch) throw new NotFoundException('确认批次不存在');
      await this.page(batch.pageId, user, workspaceId, true);
      if (batch.creatorId !== user.id)
        throw new ForbiddenException('仅发起人可以管理本批次');
      const status = revoke ? 'revoked' : 'closed';
      if (batch.status === status) return batch;
      if (batch.status !== 'open')
        throw new ConflictException('批次已结束，不能再次改变状态');
      return trx
        .updateTable('readingBatches')
        .set({ status, closedAt: new Date() })
        .where('id', '=', batch.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }
}
