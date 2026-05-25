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
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import { TransitionChangeRequestDto } from './dto/transition-change-request.dto';
import { AddExternalRefDto } from './dto/add-external-ref.dto';
import { AuditService } from '../audit/audit.service';

const ACTIVE_STATES = [
  'IN_REVIEW',
  'APPROVED',
  'IN_IMPLEMENTATION',
  'IN_VERIFICATION',
];

const TERMINAL_STATES = ['PUBLISHED', 'CLOSED', 'REJECTED', 'CANCELLED'];

const ALLOWED_FROM: Record<string, string[]> = {
  submit: ['DRAFT'],
  take_for_review: ['REQUESTED'],
  approve: ['IN_REVIEW'],
  reject: ['IN_REVIEW'],
  assign_to_self: ['APPROVED'],
  submit_for_verification: ['IN_IMPLEMENTATION'],
  reject_implementation: ['IN_VERIFICATION'],
  publish: ['IN_VERIFICATION'],
  close: ['PUBLISHED'],
  cancel: [
    'DRAFT',
    'REQUESTED',
    'IN_REVIEW',
    'APPROVED',
    'IN_IMPLEMENTATION',
    'IN_VERIFICATION',
    'PUBLISHED',
  ],
};

const TARGET_STATUS: Record<string, string> = {
  submit: 'REQUESTED',
  take_for_review: 'IN_REVIEW',
  approve: 'APPROVED',
  reject: 'REJECTED',
  assign_to_self: 'IN_IMPLEMENTATION',
  submit_for_verification: 'IN_VERIFICATION',
  reject_implementation: 'IN_IMPLEMENTATION',
  publish: 'PUBLISHED',
  close: 'CLOSED',
  cancel: 'CANCELLED',
};

const REASON_REQUIRED = new Set([
  'approve',
  'reject',
  'reject_implementation',
  'cancel',
]);

@Injectable()
export class ChangeRequestsService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly auditService: AuditService,
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

    const cr = await this.db
      .insertInto('change_requests' as any)
      .values({
        service_id: dto.serviceId,
        page_id: dto.pageId,
        title: dto.title,
        description: dto.description,
        justification: dto.justification,
        status: 'DRAFT',
        priority: dto.priority,
        impact: dto.impact,
        requested_by_id: authUser.id,
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return cr;
  }

  async getChangeRequest(id: string) {
    const cr = await this.db
      .selectFrom('change_requests' as any)
      .selectAll()
      .where('id' as any, '=', id)
      .executeTakeFirst();

    if (!cr) throw new NotFoundException('Change request not found');

    const events = await sql<any>`
      SELECT * FROM change_request_events
      WHERE change_request_id = ${id}
      ORDER BY created_at ASC
    `.execute(this.db);

    const externalRefs = await sql<any>`
      SELECT * FROM external_refs
      WHERE change_request_id = ${id}
      ORDER BY created_at ASC
    `.execute(this.db);

    return {
      ...cr,
      events: events.rows,
      externalRefs: externalRefs.rows,
    };
  }

  async listChangeRequests(dto: ListChangeRequestsDto) {
    let query = this.db
      .selectFrom('change_requests as cr' as any)
      .selectAll('cr' as any)
      .limit(dto.limit ?? 20)
      .offset(dto.offset ?? 0)
      .orderBy('cr.created_at' as any, 'desc');

    if (dto.serviceId) {
      query = query.where('cr.service_id' as any, '=', dto.serviceId);
    }
    if (dto.status) {
      query = query.where('cr.status' as any, '=', dto.status);
    }
    if (dto.priority) {
      query = query.where('cr.priority' as any, '=', dto.priority);
    }
    if (dto.requestedById) {
      query = query.where('cr.requested_by_id' as any, '=', dto.requestedById);
    }
    if (dto.implementerId) {
      query = query.where('cr.implementer_id' as any, '=', dto.implementerId);
    }
    if (dto.approverId) {
      query = query.where('cr.approver_id' as any, '=', dto.approverId);
    }
    if (dto.search) {
      query = query.where(
        sql`to_tsvector('italian', cr.title || ' ' || coalesce(cr.description, '') || ' ' || coalesce(cr.justification, ''))`,
        '@@',
        sql`plainto_tsquery('italian', ${dto.search})`,
      );
    }

    const items = await query.execute();

    const totalResult = await this.db
      .selectFrom('change_requests' as any)
      .select(this.db.fn.countAll<number>().as('count'))
      .executeTakeFirst();

    return {
      items,
      total: Number(totalResult?.count ?? 0),
      limit: dto.limit ?? 20,
      offset: dto.offset ?? 0,
    };
  }

  async transition(dto: TransitionChangeRequestDto, authUser: User) {
    const userRolesResult = await sql<{
      docops_roles: string[];
    }>`SELECT docops_roles FROM users WHERE id = ${authUser.id}`.execute(
      this.db,
    );
    const userRoles: string[] = userRolesResult.rows[0]?.docops_roles ?? [];
    const isAdmin = userRoles.includes('ADMIN');

    const cr = await this.db
      .selectFrom('change_requests' as any)
      .selectAll()
      .where('id' as any, '=', dto.id)
      .executeTakeFirst();

    if (!cr) throw new NotFoundException('Change request not found');

    const crAny = cr as any;

    if (
      dto.rowVersion !== undefined &&
      dto.rowVersion !== crAny.rowVersion
    ) {
      throw new ConflictException('Change request was modified by another user');
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

    if (dto.action === 'submit') {
      await this.checkNoActiveCr(crAny.serviceId, dto.id);
    }

    await executeTx(this.db, async (trx) => {
      const updates: Record<string, any> = {
        status: TARGET_STATUS[dto.action],
        updated_at: new Date(),
        row_version: (crAny.rowVersion ?? 0) + 1,
      };

      if (dto.action === 'take_for_review') {
        updates.approver_id = authUser.id;
      } else if (dto.action === 'approve') {
        updates.approved_at = new Date();
      } else if (dto.action === 'assign_to_self') {
        updates.implementer_id = authUser.id;
      } else if (dto.action === 'submit_for_verification') {
        const refCount = await sql<{ count: string }>`
          SELECT COUNT(*) as count FROM external_refs
          WHERE change_request_id = ${dto.id}
          AND ref_type IN ('PR', 'COMMIT')
        `.execute(trx);
        if (Number(refCount.rows[0]?.count ?? 0) === 0) {
          throw new BadRequestException(
            'At least one PR or COMMIT external ref required before submitting for verification',
          );
        }
      } else if (dto.action === 'reject_implementation') {
        updates.tech_lead_id = authUser.id;
      } else if (dto.action === 'publish') {
        const historyId = await this.createPublishedSnapshot(
          trx,
          crAny.pageId,
          dto.id,
          authUser.id,
        );
        updates.published_version_id = historyId;
        updates.published_at = new Date();
      } else if (dto.action === 'close' || dto.action === 'cancel') {
        updates.closed_at = new Date();
      }

      await trx
        .updateTable('change_requests' as any)
        .set(updates)
        .where('id' as any, '=', dto.id)
        .execute();

      await trx
        .insertInto('change_request_events' as any)
        .values({
          change_request_id: dto.id,
          from_status: crAny.status,
          to_status: TARGET_STATUS[dto.action],
          actor_id: authUser.id,
          reason: dto.reason ?? null,
          metadata: sql`'{}'::jsonb`,
        })
        .execute();
    });

    // Best-effort: audit failure must not break the transition
    try {
      await this.auditService.log({
        actorId: authUser.id,
        action: `cr.${dto.action}`,
        entityKind: 'change_request',
        entityId: dto.id,
        payloadDiff: {
          fromStatus: crAny.status,
          toStatus: TARGET_STATUS[dto.action],
          reason: dto.reason ?? null,
        },
      });
    } catch (_) {}

    return this.getChangeRequest(dto.id);
  }

  async addExternalRef(dto: AddExternalRefDto, authUser: User) {
    const cr = await this.db
      .selectFrom('change_requests' as any)
      .select(['id', 'status'])
      .where('id' as any, '=', dto.changeRequestId)
      .executeTakeFirst();

    if (!cr) throw new NotFoundException('Change request not found');

    const crStatus = (cr as any).status;
    if (!['IN_IMPLEMENTATION', 'IN_VERIFICATION'].includes(crStatus)) {
      throw new BadRequestException(
        'External refs can only be added when CR status is IN_IMPLEMENTATION or IN_VERIFICATION',
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

    const refAny = ref as any;

    const cr = await this.db
      .selectFrom('change_requests' as any)
      .select(['status'])
      .where('id' as any, '=', refAny.changeRequestId)
      .executeTakeFirst();

    if ((cr as any)?.status !== 'IN_IMPLEMENTATION') {
      throw new BadRequestException(
        'External refs can only be removed when CR status is IN_IMPLEMENTATION',
      );
    }

    await this.db
      .deleteFrom('external_refs' as any)
      .where('id' as any, '=', id)
      .execute();
  }

  private async checkNoActiveCr(serviceId: string, excludeId: string) {
    const result = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM change_requests
      WHERE service_id = ${serviceId}
      AND status = ANY(${ACTIVE_STATES}::text[])
      AND id != ${excludeId}
    `.execute(this.db);

    if (Number(result.rows[0]?.count ?? 0) > 0) {
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

    const historyRecord = await trx
      .insertInto('pageHistory')
      .values({
        pageId: page.id,
        slugId: page.slugId,
        title: page.title,
        content: page.content,
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
      .set({ currentPublishedVersionId: historyRecord.id } as any)
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
  ) {
    const allowed = ALLOWED_FROM[action];
    if (!allowed) throw new BadRequestException(`Unknown action: ${action}`);
    if (!allowed.includes(currentStatus)) {
      throw new BadRequestException(
        `Cannot perform '${action}' on a CR in status '${currentStatus}'`,
      );
    }

    if (REASON_REQUIRED.has(action) && !reason?.trim()) {
      throw new BadRequestException(
        `A reason is required for action '${action}'`,
      );
    }

    const hasRole = (role: string) => userRoles.includes(role) || isAdmin;

    const roleChecks: Record<string, () => boolean> = {
      submit: () => hasRole('PROCESS_OWNER'),
      take_for_review: () => hasRole('APPROVER'),
      approve: () => hasRole('APPROVER'),
      reject: () => hasRole('APPROVER'),
      assign_to_self: () => hasRole('DEVELOPER'),
      submit_for_verification: () => hasRole('DEVELOPER'),
      reject_implementation: () => hasRole('TECH_LEAD'),
      publish: () => hasRole('TECH_LEAD'),
      close: () => isAdmin,
      cancel: () => {
        // From terminal-adjacent states: admin only
        const adminOnlyStates = [
          'IN_REVIEW',
          'APPROVED',
          'IN_IMPLEMENTATION',
          'IN_VERIFICATION',
          'PUBLISHED',
        ];
        if (adminOnlyStates.includes(currentStatus)) return isAdmin;
        // From DRAFT/REQUESTED: creator with PROCESS_OWNER role or admin
        return (
          isAdmin ||
          (actorId === creatorId && userRoles.includes('PROCESS_OWNER'))
        );
      },
    };

    if (!roleChecks[action]()) {
      throw new ForbiddenException(
        `Insufficient role to perform '${action}'`,
      );
    }
  }
}
