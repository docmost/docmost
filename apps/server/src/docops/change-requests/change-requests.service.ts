import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { sql } from 'kysely';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import { TransitionChangeRequestDto } from './dto/transition-change-request.dto';
import { AddExternalRefDto } from './dto/add-external-ref.dto';
import { SaveDraftContentDto } from './dto/save-draft-content.dto';
import { AuditService } from '../audit/audit.service';
import { WebhookDeliveryService } from '../webhooks/webhook-delivery.service';
import { QueueName, QueueJob } from '../../integrations/queue/constants';
import { ChangeRequestsRepository } from './change-requests.repository';
import { DOCOPS_CR_EMAIL_QUEUE, CR_NOTIFY_EMAIL_JOB } from './cr-notify-email.constants';
import {
  validateCrTransition,
  getTargetStatus,
  CR_STATE_MACHINE,
} from './state-machine/cr-state-machine';
import { CrAction, TransitionContext, TransitionDef } from './state-machine/cr-state.types';
import { CrEventsEmitter } from './events/cr-events.emitter';
import { isValidSemVer, isGreaterSemVer } from './utils/semver.util';

@Injectable()
export class ChangeRequestsService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly repo: ChangeRequestsRepository,
    private readonly auditService: AuditService,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly crEventsEmitter: CrEventsEmitter,
    @InjectQueue(QueueName.SEARCH_QUEUE) private readonly searchQueue: Queue,
    @InjectQueue(DOCOPS_CR_EMAIL_QUEUE) private readonly crEmailQueue: Queue,
  ) {}

  async createChangeRequest(dto: CreateChangeRequestDto, authUser: User) {
    const service = await this.db
      .selectFrom('services' as any)
      .select(['id'])
      .where('id' as any, '=', dto.serviceId)
      .executeTakeFirst();
    if (!service) throw new NotFoundException('Service not found');

    const page = await this.db
      .selectFrom('pages')
      .select(['id'])
      .where('id', '=', dto.pageId)
      .executeTakeFirst();
    if (!page) throw new NotFoundException('Page not found');

    await this.checkNoActiveCr(dto.serviceId, '00000000-0000-0000-0000-000000000000');

    return this.repo.insert({
      service_id: dto.serviceId,
      page_id: dto.pageId,
      title: dto.title,
      description: dto.description,
      justification: dto.justification,
      status: 'IN_REVIEW',
      priority: dto.priority,
      impact: dto.impact,
      requested_by_id: authUser.id,
      due_date: dto.dueDate ? new Date(dto.dueDate) : null,
    });
  }

  async getChangeRequest(id: string) {
    const cr = await this.repo.findById(id);
    if (!cr) throw new NotFoundException('Change request not found');

    const [events, externalRefs] = await Promise.all([
      this.repo.getEvents(id),
      this.repo.getExternalRefs(id),
    ]);

    return { ...cr, events, externalRefs };
  }

  async listChangeRequests(dto: ListChangeRequestsDto) {
    const { items, total } = await this.repo.listWithCount({
      serviceId: dto.serviceId,
      status: dto.status,
      priority: dto.priority,
      requestedById: dto.requestedById,
      implementerId: dto.implementerId,
      approverId: dto.approverId,
      search: dto.search,
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    });

    return { items, total, limit: dto.limit ?? 20, offset: dto.offset ?? 0 };
  }

  async transition(dto: TransitionChangeRequestDto, authUser: User) {
    const userRoles = await this.repo.getUserRoles(authUser.id);
    const isAdmin = userRoles.includes('ADMIN');

    const cr = await this.repo.findById(dto.id);
    if (!cr) throw new NotFoundException('Change request not found');

    const crAny = cr as any;

    if (dto.rowVersion !== undefined && dto.rowVersion !== crAny.rowVersion) {
      throw new ConflictException('Change request was modified by another user');
    }

    if (dto.action === 'close' && !dto.closeReason) {
      throw new BadRequestException("'closeReason' (REJECTED or CANCELLED) is required for action 'close'");
    }
    if (dto.action !== 'close' && dto.closeReason) {
      throw new BadRequestException("'closeReason' is only valid for action 'close'");
    }

    this.validateTransition(
      dto.action,
      crAny.status,
      userRoles,
      isAdmin,
      authUser.id,
      crAny.requestedById,
      dto.reason,
    );

    // True no-op: assign_to_self when already assigned to same developer — skip event
    if (dto.action === 'assign_to_self' && crAny.implementerId === authUser.id) {
      return this.getChangeRequest(dto.id);
    }

    const targetStatus = getTargetStatus(dto.action as CrAction);

    await executeTx(this.db, async (trx) => {
      const updates: Record<string, any> = {
        status: targetStatus,
        updated_at: new Date(),
        row_version: (crAny.rowVersion ?? 0) + 1,
      };

      if (dto.action === 'approve') {
        updates.approved_at = new Date();
        updates.approver_id = authUser.id;
      } else if (dto.action === 'verify') {
        updates.tech_lead_id = authUser.id;
      } else if (dto.action === 'assign_to_self') {
        // Idempotent: if already assigned to this developer, no-op (no error)
        if (crAny.implementerId && crAny.implementerId !== authUser.id) {
          throw new ConflictException('CR is already assigned to another implementer');
        }
        updates.implementer_id = authUser.id;
        await trx
          .updateTable('pages')
          .set({ crDraftId: dto.id })
          .where('id', '=', crAny.pageId)
          .execute();
        // Grant writer to space
        await (trx as any)
          .updateTable('spaceMembers')
          .set({ role: 'writer' })
          .where('userId', '=', authUser.id)
          .where(
            'spaceId',
            '=',
            (trx as any)
              .selectFrom('services')
              .select('spaceId')
              .where('id', '=', crAny.serviceId),
          )
          .execute();
      } else if (dto.action === 'publish') {
        // Requires >=1 external ref — checked inside the transaction to avoid TOCTOU
        const refCountRow = await (trx as any)
          .selectFrom('external_refs')
          .select(sql`COUNT(*)`.as('count'))
          .where('change_request_id', '=', dto.id)
          .where('ref_type', 'in', ['PR', 'COMMIT'])
          .executeTakeFirst();
        if (Number(refCountRow?.count ?? 0) === 0) {
          throw new BadRequestException(
            'At least one PR or COMMIT external ref required before publishing',
          );
        }
        if (!dto.docVersion) {
          throw new BadRequestException('docVersion is required for publish');
        }
        if (!isValidSemVer(dto.docVersion)) {
          throw new BadRequestException('docVersion must be a valid SemVer (e.g. 1.2.3)');
        }
        const serviceRow = await (trx as any)
          .selectFrom('services')
          .select('doc_version as docVersion')
          .where('id', '=', crAny.serviceId)
          .executeTakeFirstOrThrow();
        if (!isGreaterSemVer(dto.docVersion, serviceRow.docVersion)) {
          throw new BadRequestException(
            `docVersion must be greater than current version (${serviceRow.docVersion ?? '0.0.0'})`,
          );
        }
        updates.doc_version = dto.docVersion;
        await (trx as any)
          .updateTable('services')
          .set({ doc_version: dto.docVersion })
          .where('id', '=', crAny.serviceId)
          .execute();
        const historyId = await this.createPublishedSnapshot(
          trx,
          crAny.pageId,
          dto.id,
          authUser.id,
        );
        updates.published_version_id = historyId;
        updates.published_at = new Date();
        updates.tech_lead_id = authUser.id;
        // Revoke writer from implementer
        if (crAny.implementerId) {
          await (trx as any)
            .updateTable('spaceMembers')
            .set({ role: 'reader' })
            .where('userId', '=', crAny.implementerId)
            .where(
              'spaceId',
              '=',
              (trx as any)
                .selectFrom('services')
                .select('spaceId')
                .where('id', '=', crAny.serviceId),
            )
            .execute();
        }
      } else if (dto.action === 'close') {
        updates.closed_at = new Date();
        updates.close_reason = dto.closeReason ?? null;
        // Revoke writer from implementer if any
        if (crAny.implementerId) {
          await (trx as any)
            .updateTable('spaceMembers')
            .set({ role: 'reader' })
            .where('userId', '=', crAny.implementerId)
            .where(
              'spaceId',
              '=',
              (trx as any)
                .selectFrom('services')
                .select('spaceId')
                .where('id', '=', crAny.serviceId),
            )
            .execute();
        }
      }

      await this.repo.updateById(dto.id, updates, trx);
      await this.repo.insertEvent(
        {
          changeRequestId: dto.id,
          fromStatus: crAny.status,
          toStatus: targetStatus,
          actorId: authUser.id,
          reason: dto.reason ?? null,
        },
        trx,
      );
    });

    const result = await this.getChangeRequest(dto.id);

    // Side effects — best-effort, must not break the transition
    try {
      await this.auditService.log({
        actorId: authUser.id,
        action: `cr.${dto.action}`,
        entityKind: 'change_request',
        entityId: dto.id,
        payloadDiff: {
          fromStatus: crAny.status,
          toStatus: targetStatus,
          reason: dto.reason ?? null,
        },
      });
    } catch (_) {}

    try {
      await this.webhookDeliveryService.deliver(
        `cr.${dto.action}`,
        crAny.serviceId,
        result,
      );
    } catch (_) {}

    if (dto.action === 'publish') {
      try {
        await this.searchQueue.add(QueueJob.PAGE_UPDATED, {
          pageIds: [crAny.pageId],
        });
      } catch (_) {}

      this.crEventsEmitter.emitPublished({
        crId: dto.id,
        action: dto.action,
        fromStatus: crAny.status,
        toStatus: targetStatus,
        actorId: authUser.id,
        serviceId: crAny.serviceId,
        pageId: crAny.pageId,
        reason: dto.reason ?? null,
        publishedVersionId: (result as any).publishedVersionId,
      });
    } else {
      this.crEventsEmitter.emitTransition({
        crId: dto.id,
        action: dto.action,
        fromStatus: crAny.status,
        toStatus: targetStatus,
        actorId: authUser.id,
        serviceId: crAny.serviceId,
        pageId: crAny.pageId,
        reason: dto.reason ?? null,
      });
    }

    try {
      await this.sendTransitionNotification(dto.action, dto.id, crAny, authUser);
    } catch (_) {}

    return result;
  }

  async saveDraftContent(dto: SaveDraftContentDto, authUser: User) {
    const cr = await this.db
      .selectFrom('change_requests' as any)
      .select(['id', 'status', 'implementerId', 'pageId'] as any)
      .where('id' as any, '=', dto.changeRequestId)
      .executeTakeFirst();

    if (!cr) throw new NotFoundException('Change request not found');

    const crAny = cr as any;
    if (crAny.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Draft content can only be saved when CR is IN_PROGRESS',
      );
    }
    if (crAny.implementerId !== authUser.id) {
      throw new ForbiddenException(
        'Only the assigned implementer can save draft content',
      );
    }

    await this.db
      .updateTable('pages')
      .set({ content: dto.content, lastUpdatedById: authUser.id } as any)
      .where('id', '=', crAny.pageId)
      .execute();

    return { saved: true };
  }

  async addExternalRef(dto: AddExternalRefDto, authUser: User) {
    const cr = await this.repo.findById(dto.changeRequestId);
    if (!cr) throw new NotFoundException('Change request not found');

    const crStatus = (cr as any).status;
    if (crStatus !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'External refs can only be added when CR status is IN_PROGRESS',
      );
    }

    return this.db
      .insertInto('external_refs' as any)
      .values({
        change_request_id: dto.changeRequestId,
        ref_type: dto.refType,
        url: dto.url,
        label: dto.label ?? null,
        created_by_id: authUser.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async removeExternalRef(id: string, authUser: User) {
    const ref = await this.db
      .selectFrom('external_refs' as any)
      .select(['id', 'change_request_id', 'created_by_id'])
      .where('id' as any, '=', id)
      .executeTakeFirst();

    if (!ref) throw new NotFoundException('External ref not found');

    const cr = await this.repo.findById((ref as any).changeRequestId);
    if ((cr as any)?.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'External refs can only be removed when CR status is IN_PROGRESS',
      );
    }

    await this.db
      .deleteFrom('external_refs' as any)
      .where('id' as any, '=', id)
      .execute();
  }

  async getEvents(crId: string) {
    const cr = await this.repo.findById(crId);
    if (!cr) throw new NotFoundException('Change request not found');
    return this.repo.getEvents(crId);
  }

  async getAvailableTransitions(id: string, authUser: User) {
    const cr = await this.repo.findById(id);
    if (!cr) throw new NotFoundException('Change request not found');

    const crAny = cr as any;
    const userRoles = await this.repo.getUserRoles(authUser.id);
    const isAdmin = userRoles.includes('ADMIN');

    const ctx: TransitionContext = {
      userRoles,
      isAdmin,
      actorId: authUser.id,
      creatorId: crAny.requestedById,
      currentStatus: crAny.status,
    };

    const actions = (
      Object.entries(CR_STATE_MACHINE) as [CrAction, TransitionDef][]
    )
      .filter(([, def]) => def.from.includes(ctx.currentStatus) && def.canExecute(ctx))
      .map(([action, def]) => ({
        action,
        requiresReason: def.requiresReason,
        targetStatus: def.to,
      }));

    return { actions };
  }

  private async sendTransitionNotification(
    action: string,
    crId: string,
    crAny: any,
    actor: User,
  ) {
    const NOTIFIED_ACTIONS = new Set(['approve', 'verify', 'publish']);
    if (!NOTIFIED_ACTIONS.has(action)) return;

    await this.crEmailQueue.add(CR_NOTIFY_EMAIL_JOB, {
      action,
      crId,
      crData: {
        title: crAny.title ?? '',
        serviceId: crAny.serviceId ?? '',
        requestedById: crAny.requestedById ?? '',
        justification: crAny.justification ?? '',
      },
      actorName: actor.name ?? 'Un utente',
    });
  }

  private async checkNoActiveCr(serviceId: string, excludeId: string) {
    const count = await this.repo.countActiveCrs(serviceId, excludeId);
    if (count > 0) {
      throw new ConflictException(
        'An active change request already exists for this service',
      );
    }
  }

  private async createPublishedSnapshot(
    trx: any,
    pageId: string,
    changeRequestId: string,
    actorId: string,
  ): Promise<string> {
    const page = await trx
      .selectFrom('pages')
      .select([
        'id',
        'title',
        'content',
        'slugId',
        'icon',
        'coverPhoto',
        'spaceId',
        'workspaceId',
        'lastUpdatedById',
        'creatorId',
      ])
      .where('id', '=', pageId)
      .executeTakeFirst();

    if (!page) throw new NotFoundException('Page not found');

    const publishedContent = page.content;

    const historyRecord = await trx
      .insertInto('pageHistory')
      .values({
        pageId: page.id,
        slugId: page.slugId,
        title: page.title,
        content: publishedContent,
        icon: page.icon,
        coverPhoto: page.coverPhoto,
        lastUpdatedById: actorId,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
        changeRequestId: changeRequestId,
        isPublishedVersion: true,
        publishedAt: new Date(),
        publishedById: actorId,
      } as any)
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('pages')
      .set({
        content: publishedContent,
        currentPublishedVersionId: historyRecord.id,
        crDraftId: null,
      } as any)
      .where('id', '=', pageId)
      .execute();

    return historyRecord.id;
  }

  private validateTransition(
    action: string,
    currentStatus: string,
    userRoles: string[],
    isAdmin: boolean,
    actorId: string,
    creatorId: string,
    reason?: string,
  ): void {
    const ctx: TransitionContext = {
      userRoles,
      isAdmin,
      actorId,
      creatorId,
      currentStatus: currentStatus as any,
    };
    validateCrTransition(action, ctx, reason);
  }
}
