import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { Inject } from '@nestjs/common';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { sql } from 'kysely';
import {
  calculateVerificationExpiry,
  getExpiringVerificationStatus,
} from './page-verification.utils';

type VerificationType = 'expiring' | 'qms';
type VerificationStatus =
  | 'verified'
  | 'expiring'
  | 'expired'
  | 'draft'
  | 'in_approval'
  | 'approved'
  | 'obsolete';

@Injectable()
export class PageVerificationService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getInfo(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanView(page, user);

    const verification = await this.getVerificationByPageId(page.id);
    if (!verification) {
      return { status: 'none' };
    }

    const current = await this.refreshExpiringStatus(verification.id);
    const verifiers = await this.getVerifiers(current.id);
    const verifierIds = verifiers.map((verifier) => verifier.id);

    return {
      id: current.id,
      pageId: current.pageId,
      type: current.type,
      mode: current.mode,
      periodAmount: current.periodAmount,
      periodUnit: current.periodUnit,
      status: current.status,
      verifiedAt: current.verifiedAt,
      verifiedBy: current.verifiedById
        ? await this.getUserRef(current.verifiedById)
        : null,
      expiresAt: current.expiresAt,
      requestedAt: current.requestedAt,
      requestedBy: current.requestedById
        ? await this.getUserRef(current.requestedById)
        : null,
      rejectedAt: current.rejectedAt,
      rejectedBy: current.rejectedById
        ? await this.getUserRef(current.rejectedById)
        : null,
      rejectionComment: current.rejectionComment,
      verifiers,
      permissions: await this.buildPermissions(page, user, current, verifierIds),
    };
  }

  async createVerification(
    body: {
      pageId: string;
      type?: VerificationType;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds: string[];
    },
    user: User,
    workspace: Workspace,
  ) {
    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const existing = await this.getVerificationByPageId(page.id);
    if (existing) {
      throw new BadRequestException('Verification already exists for this page');
    }

    const verifierIds = await this.assertVerifierIds(body.verifierIds, workspace.id);
    const now = new Date();
    const type = body.type ?? 'expiring';
    const expiresAt =
      type === 'expiring'
        ? calculateVerificationExpiry({
            mode: body.mode,
            periodAmount: body.periodAmount,
            periodUnit: body.periodUnit,
            fixedExpiresAt: body.fixedExpiresAt
              ? new Date(body.fixedExpiresAt)
              : null,
            baseDate: now,
          })
        : null;
    const status: VerificationStatus =
      type === 'expiring' ? getExpiringVerificationStatus(expiresAt, now) : 'draft';

    const created = await this.db
      .insertInto('pageVerifications')
      .values({
        pageId: page.id,
        workspaceId: workspace.id,
        spaceId: page.spaceId,
        type,
        status,
        mode: type === 'expiring' ? body.mode ?? 'period' : null,
        periodAmount: type === 'expiring' ? body.periodAmount ?? 1 : null,
        periodUnit: type === 'expiring' ? body.periodUnit ?? 'month' : null,
        verifiedAt: type === 'expiring' ? now : null,
        verifiedById: type === 'expiring' ? user.id : null,
        expiresAt,
        creatorId: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.replaceVerifiers(created.id, verifierIds, user.id);

    this.auditService.log({
      event: AuditEvent.PAGE_VERIFICATION_CREATED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: created.id,
        type,
        verifierIds,
      },
    });
  }

  async updateVerification(
    body: {
      pageId: string;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds?: string[];
    },
    user: User,
    workspace: Workspace,
  ) {
    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const verification = await this.getVerificationOrThrow(page.id);
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (verification.type === 'expiring') {
      const nextMode = body.mode ?? verification.mode ?? 'period';
      const nextPeriodAmount =
        typeof body.periodAmount === 'number'
          ? body.periodAmount
          : verification.periodAmount ?? 1;
      const nextPeriodUnit =
        body.periodUnit ?? verification.periodUnit ?? 'month';
      const nextExpiresAt = calculateVerificationExpiry({
        mode: nextMode,
        periodAmount: nextPeriodAmount,
        periodUnit: nextPeriodUnit,
        fixedExpiresAt: body.fixedExpiresAt
          ? new Date(body.fixedExpiresAt)
          : nextMode === 'fixed'
            ? verification.expiresAt
              ? new Date(verification.expiresAt)
              : null
            : null,
        baseDate: verification.verifiedAt
          ? new Date(verification.verifiedAt)
          : new Date(),
      });

      patch.mode = nextMode;
      patch.periodAmount = nextMode === 'period' ? nextPeriodAmount : null;
      patch.periodUnit = nextMode === 'period' ? nextPeriodUnit : null;
      patch.expiresAt = nextExpiresAt;
      patch.status =
        verification.status === 'obsolete'
          ? 'obsolete'
          : getExpiringVerificationStatus(nextExpiresAt);
    }

    if (body.verifierIds) {
      const verifierIds = await this.assertVerifierIds(
        body.verifierIds,
        workspace.id,
      );
      await this.replaceVerifiers(verification.id, verifierIds, user.id);
    }

    await this.db
      .updateTable('pageVerifications')
      .set(patch)
      .where('id', '=', verification.id)
      .execute();

    this.auditService.log({
      event: AuditEvent.PAGE_VERIFICATION_UPDATED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async deleteVerification(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const verification = await this.getVerificationOrThrow(page.id);

    await this.db
      .deleteFrom('pageVerifications')
      .where('id', '=', verification.id)
      .execute();

    this.auditService.log({
      event: AuditEvent.PAGE_VERIFICATION_REMOVED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async verifyPage(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanView(page, user);

    const verification = await this.getVerificationOrThrow(page.id);
    const verifiers = await this.getVerifiers(verification.id);
    const verifierIds = verifiers.map((verifier) => verifier.id);
    const permissions = await this.buildPermissions(
      page,
      user,
      verification,
      verifierIds,
    );

    if (!permissions.canVerify) {
      throw new ForbiddenException();
    }

    const now = new Date();
    let status: VerificationStatus;
    let expiresAt = verification.expiresAt ? new Date(verification.expiresAt) : null;

    if (verification.type === 'qms') {
      status = 'approved';
    } else {
      expiresAt = calculateVerificationExpiry({
        mode: verification.mode,
        periodAmount: verification.periodAmount,
        periodUnit: verification.periodUnit,
        fixedExpiresAt:
          verification.mode === 'fixed' && verification.expiresAt
            ? new Date(verification.expiresAt)
            : null,
        baseDate: now,
      });
      status = getExpiringVerificationStatus(expiresAt, now);
    }

    await this.db
      .updateTable('pageVerifications')
      .set({
        status,
        verifiedAt: now,
        verifiedById: user.id,
        expiresAt,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
        updatedAt: now,
      })
      .where('id', '=', verification.id)
      .execute();

    await this.notificationQueue.add(QueueJob.PAGE_VERIFIED_NOTIFICATION, {
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: workspace.id,
      actorId: user.id,
      verifierIds: verifierIds.filter((verifierId) => verifierId !== user.id),
    });

    this.auditService.log({
      event: AuditEvent.PAGE_VERIFIED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async submitForApproval(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const verification = await this.getVerificationOrThrow(page.id);
    if (verification.type !== 'qms') {
      throw new BadRequestException('Approval workflow is not enabled');
    }
    if (
      verification.status !== 'draft' &&
      verification.status !== 'approved'
    ) {
      throw new BadRequestException(
        'This page cannot be submitted for approval right now',
      );
    }

    const verifiers = await this.getVerifiers(verification.id);
    const verifierIds = verifiers.map((verifier) => verifier.id);

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'in_approval',
        requestedAt: new Date(),
        requestedById: user.id,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
        updatedAt: new Date(),
      })
      .where('id', '=', verification.id)
      .execute();

    await this.notificationQueue.add(
      QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION,
      {
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: workspace.id,
        actorId: user.id,
        verifierIds: verifierIds.filter((verifierId) => verifierId !== user.id),
      },
    );

    this.auditService.log({
      event: AuditEvent.PAGE_APPROVAL_REQUESTED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async rejectApproval(
    body: { pageId: string; comment?: string },
    user: User,
    workspace: Workspace,
  ) {
    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanView(page, user);

    const verification = await this.getVerificationOrThrow(page.id);
    if (verification.type !== 'qms' || verification.status !== 'in_approval') {
      throw new BadRequestException('This page is not awaiting approval');
    }

    const verifiers = await this.getVerifiers(verification.id);
    const permissions = await this.buildPermissions(
      page,
      user,
      verification,
      verifiers.map((verifier) => verifier.id),
    );
    if (!permissions.canVerify) {
      throw new ForbiddenException();
    }

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'draft',
        rejectedAt: new Date(),
        rejectedById: user.id,
        rejectionComment: body.comment ?? null,
        updatedAt: new Date(),
      })
      .where('id', '=', verification.id)
      .execute();

    if (
      verification.requestedById &&
      verification.requestedById !== user.id
    ) {
      await this.notificationQueue.add(
        QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION,
        {
          pageId: page.id,
          spaceId: page.spaceId,
          workspaceId: workspace.id,
          actorId: user.id,
          requestedById: verification.requestedById,
          comment: body.comment,
        },
      );
    }

    this.auditService.log({
      event: AuditEvent.PAGE_APPROVAL_REJECTED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async markObsolete(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const verification = await this.getVerificationOrThrow(page.id);
    if (verification.type !== 'qms') {
      throw new BadRequestException('Approval workflow is not enabled');
    }
    if (verification.status !== 'approved') {
      throw new BadRequestException(
        'Only approved documents can be marked obsolete',
      );
    }

    await this.db
      .updateTable('pageVerifications')
      .set({
        status: 'obsolete',
        updatedAt: new Date(),
      })
      .where('id', '=', verification.id)
      .execute();

    this.auditService.log({
      event: AuditEvent.PAGE_MARKED_OBSOLETE,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        verificationId: verification.id,
      },
    });
  }

  async listVerifications(
    user: User,
    workspace: Workspace,
    pagination: PaginationOptions & {
      spaceIds?: string[];
      verifierId?: string;
      type?: VerificationType;
    },
  ) {
    let query = this.db
      .selectFrom('pageVerifications')
      .innerJoin('pages', 'pages.id', 'pageVerifications.pageId')
      .innerJoin('spaces', 'spaces.id', 'pageVerifications.spaceId')
      .select([
        'pageVerifications.id',
        'pageVerifications.pageId',
        'pageVerifications.spaceId',
        'pageVerifications.type',
        'pageVerifications.status',
        'pageVerifications.mode',
        'pageVerifications.periodAmount',
        'pageVerifications.periodUnit',
        'pageVerifications.verifiedAt',
        'pageVerifications.expiresAt',
        'pageVerifications.createdAt',
        'pages.title as pageTitle',
        'pages.slugId as pageSlugId',
        'pages.icon as pageIcon',
        'spaces.name as spaceName',
        'spaces.slug as spaceSlug',
      ])
      .where('pageVerifications.workspaceId', '=', workspace.id);

    if (pagination.spaceIds?.length) {
      query = query.where('pageVerifications.spaceId', 'in', pagination.spaceIds);
    }

    if (pagination.type) {
      query = query.where('pageVerifications.type', '=', pagination.type);
    }

    if (pagination.verifierId) {
      query = query.where(({ exists, selectFrom }) =>
        exists(
          selectFrom('pageVerifiers')
            .select('pageVerifiers.id')
            .whereRef(
              'pageVerifiers.pageVerificationId',
              '=',
              'pageVerifications.id',
            )
            .where('pageVerifiers.userId', '=', pagination.verifierId),
        ),
      );
    }

    if (pagination.query) {
      query = query.where((eb) =>
        eb(
          sql`f_unaccent("pages"."title")`,
          'ilike',
          sql`f_unaccent(${`%${pagination.query}%`})`,
        ),
      );
    }

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit ?? 50,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        {
          expression: 'pageVerifications.createdAt',
          direction: 'desc',
          key: 'createdAt',
        },
        { expression: 'pageVerifications.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });

    const accessibleItems = [];
    for (const item of result.items) {
      const canAccess = await this.canAccessPage(user, item.pageId, item.spaceId);
      if (canAccess) {
        accessibleItems.push(item);
      }
    }

    const verificationIds = accessibleItems.map((item) => item.id);
    const verifiers = await this.getVerifiersForVerificationIds(verificationIds);

    return {
      items: accessibleItems.map((item) => ({
        ...item,
        status:
          item.type === 'expiring'
            ? getExpiringVerificationStatus(
                item.expiresAt ? new Date(item.expiresAt) : null,
              )
            : item.status,
        verifiers: verifiers.get(item.id) ?? [],
      })),
      meta: result.meta,
    };
  }

  async reconcileExpiringVerification(verificationId: string) {
    const verification = await this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('id', '=', verificationId)
      .executeTakeFirst();

    if (!verification) return null;
    return this.refreshExpiringStatus(verification.id);
  }

  private async refreshExpiringStatus(verificationId: string) {
    const verification = await this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('id', '=', verificationId)
      .executeTakeFirstOrThrow();

    if (verification.type !== 'expiring' || verification.status === 'obsolete') {
      return verification;
    }

    const nextStatus = getExpiringVerificationStatus(
      verification.expiresAt ? new Date(verification.expiresAt) : null,
    );

    if (verification.status !== nextStatus) {
      await this.db
        .updateTable('pageVerifications')
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where('id', '=', verification.id)
        .execute();

      return {
        ...verification,
        status: nextStatus,
      };
    }

    return verification;
  }

  private async getPageOrThrow(pageId: string, workspaceId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private async getVerificationByPageId(pageId: string) {
    return this.db
      .selectFrom('pageVerifications')
      .selectAll()
      .where('pageId', '=', pageId)
      .executeTakeFirst();
  }

  private async getVerificationOrThrow(pageId: string) {
    const verification = await this.getVerificationByPageId(pageId);
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    return verification;
  }

  private async assertVerifierIds(verifierIds: string[], workspaceId: string) {
    const uniqueVerifierIds = Array.from(new Set(verifierIds));
    if (uniqueVerifierIds.length === 0) {
      throw new BadRequestException('At least one verifier is required');
    }

    const users = await this.db
      .selectFrom('users')
      .select('id')
      .where('id', 'in', uniqueVerifierIds)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .execute();

    if (users.length !== uniqueVerifierIds.length) {
      throw new BadRequestException('One or more verifiers were not found');
    }

    return uniqueVerifierIds;
  }

  private async replaceVerifiers(
    verificationId: string,
    verifierIds: string[],
    addedById: string,
  ) {
    await this.db
      .deleteFrom('pageVerifiers')
      .where('pageVerificationId', '=', verificationId)
      .execute();

    await this.db
      .insertInto('pageVerifiers')
      .values(
        verifierIds.map((userId, index) => ({
          pageVerificationId: verificationId,
          userId,
          isPrimary: index === 0,
          addedById,
        })),
      )
      .execute();
  }

  private async getVerifiers(verificationId: string) {
    const rows = await this.db
      .selectFrom('pageVerifiers')
      .innerJoin('users', 'users.id', 'pageVerifiers.userId')
      .select([
        'users.id',
        'users.name',
        'users.avatarUrl',
        'users.email',
      ])
      .where('pageVerifiers.pageVerificationId', '=', verificationId)
      .execute();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatarUrl,
      email: row.email,
    }));
  }

  private async getVerifiersForVerificationIds(verificationIds: string[]) {
    if (verificationIds.length === 0) {
      return new Map<string, Array<{ id: string; name: string; avatarUrl: string | null }>>();
    }

    const rows = await this.db
      .selectFrom('pageVerifiers')
      .innerJoin('users', 'users.id', 'pageVerifiers.userId')
      .select([
        'pageVerifiers.pageVerificationId',
        'users.id',
        'users.name',
        'users.avatarUrl',
      ])
      .where('pageVerifiers.pageVerificationId', 'in', verificationIds)
      .execute();

    const grouped = new Map<
      string,
      Array<{ id: string; name: string; avatarUrl: string | null }>
    >();

    for (const row of rows) {
      const current = grouped.get(row.pageVerificationId) ?? [];
      current.push({
        id: row.id,
        name: row.name,
        avatarUrl: row.avatarUrl,
      });
      grouped.set(row.pageVerificationId, current);
    }

    return grouped;
  }

  private async getUserRef(userId: string) {
    return this.db
      .selectFrom('users')
      .select(['id', 'name', 'avatarUrl'])
      .where('id', '=', userId)
      .executeTakeFirst();
  }

  private async buildPermissions(
    page: { id: string; spaceId: string },
    user: User,
    verification: { type: string; status: string | null },
    verifierIds: string[],
  ) {
    const access = await this.pagePermissionRepo.getUserPageAccessLevel(
      user.id,
      page.id,
    );
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    const canEdit = access.hasAnyRestriction
      ? access.canEdit
      : ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
    const isVerifier = verifierIds.includes(user.id);

    if (verification.type === 'qms') {
      return {
        canVerify: isVerifier && verification.status === 'in_approval',
        canManage: canEdit,
        canSubmitForApproval:
          canEdit &&
          (verification.status === 'draft' || verification.status === 'approved'),
        canMarkObsolete: canEdit && verification.status === 'approved',
      };
    }

    return {
      canVerify: isVerifier && verification.status !== 'obsolete',
      canManage: canEdit,
      canSubmitForApproval: false,
      canMarkObsolete: false,
    };
  }

  private async canAccessPage(user: User, pageId: string, spaceId: string) {
    try {
      const ability = await this.spaceAbility.createForUser(user, spaceId);
      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        return false;
      }
    } catch {
      return false;
    }

    const pageIds = await this.pagePermissionRepo.filterAccessiblePageIds({
      pageIds: [pageId],
      userId: user.id,
      spaceId,
    });

    return pageIds.includes(pageId);
  }
}
