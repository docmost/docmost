import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PageVerificationRepo } from './page-verification.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';

const EXPIRING_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

type PeriodUnit = 'day' | 'week' | 'month' | 'year';

@Injectable()
export class PageVerificationService {
  constructor(
    private readonly pageVerificationRepo: PageVerificationRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  private async getPageOrThrow(pageId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private computeExpiresAt(opts: {
    mode?: string | null;
    periodAmount?: number | null;
    periodUnit?: string | null;
    fixedExpiresAt?: string;
    from?: Date;
  }): Date | null {
    const from = opts.from ?? new Date();
    if (opts.mode === 'indefinite') return null;
    if (opts.mode === 'fixed' && opts.fixedExpiresAt) {
      return new Date(opts.fixedExpiresAt);
    }
    if (opts.mode === 'period' && opts.periodAmount && opts.periodUnit) {
      const date = new Date(from);
      const amount = opts.periodAmount;
      const unit = opts.periodUnit as PeriodUnit;
      if (unit === 'day') date.setDate(date.getDate() + amount);
      else if (unit === 'week') date.setDate(date.getDate() + amount * 7);
      else if (unit === 'month') date.setMonth(date.getMonth() + amount);
      else if (unit === 'year') date.setFullYear(date.getFullYear() + amount);
      return date;
    }
    return null;
  }

  private computeExpiringStatus(verification: {
    verifiedAt: Date | null;
    expiresAt: Date | null;
    status: string | null;
  }): string {
    if (verification.status === 'obsolete') return 'obsolete';
    if (!verification.verifiedAt) return 'draft';
    if (!verification.expiresAt) return 'verified';
    const now = Date.now();
    const expiresMs = new Date(verification.expiresAt).getTime();
    if (expiresMs <= now) return 'expired';
    if (expiresMs - now <= EXPIRING_WARNING_MS) return 'expiring';
    return 'verified';
  }

  private resolveStatus(
    verification: {
      type: string;
      status: string | null;
      verifiedAt: Date | null;
      expiresAt: Date | null;
    } | null,
  ): string {
    if (!verification) return 'none';
    if (verification.type === 'qms') {
      return verification.status ?? 'draft';
    }
    return this.computeExpiringStatus(verification);
  }

  private async canManage(page: { spaceId: string; creatorId: string | null }, user: User) {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      return true;
    }
    if (page.creatorId === user.id) return true;
    try {
      await this.pageAccessService.validateCanEdit(page as any, user);
      return true;
    } catch {
      return false;
    }
  }

  private async buildInfo(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);

    const detail = await this.pageVerificationRepo.findDetailByPageId(pageId);
    if (!detail) {
      return { status: 'none' as const };
    }

    const verifiers = await this.pageVerificationRepo.getVerifiers(detail.id);
    const status = this.resolveStatus(detail);
    const isVerifier = await this.pageVerificationRepo.isVerifier(
      detail.id,
      user.id,
    );
    const canManage = await this.canManage(page, user);

    return {
      id: detail.id,
      pageId: detail.pageId,
      type: detail.type,
      mode: detail.mode,
      periodAmount: detail.periodAmount,
      periodUnit: detail.periodUnit,
      status,
      verifiedAt: detail.verifiedAt?.toISOString() ?? null,
      verifiedBy: detail.verifiedBy ?? null,
      expiresAt: detail.expiresAt?.toISOString() ?? null,
      requestedAt: detail.requestedAt?.toISOString() ?? null,
      requestedBy: detail.requestedBy ?? null,
      rejectedAt: detail.rejectedAt?.toISOString() ?? null,
      rejectedBy: detail.rejectedBy ?? null,
      rejectionComment: detail.rejectionComment,
      verifiers: verifiers.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        avatarUrl: v.avatarUrl,
      })),
      permissions: {
        canVerify: isVerifier,
        canManage,
        canSubmitForApproval:
          detail.type === 'qms' &&
          status === 'draft' &&
          (await this.canManage(page, user)),
        canMarkObsolete:
          detail.type === 'qms' &&
          status === 'approved' &&
          canManage,
      },
    };
  }

  async getInfo(pageId: string, user: User) {
    return this.buildInfo(pageId, user);
  }

  async setup(
    data: {
      pageId: string;
      type?: string;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds: string[];
    },
    user: User,
    workspaceId: string,
  ) {
    const page = await this.getPageOrThrow(data.pageId);
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }

    const existing = await this.pageVerificationRepo.findByPageId(data.pageId);
    if (existing) {
      throw new BadRequestException('Verification already exists');
    }
    if (!data.verifierIds?.length) {
      throw new BadRequestException('At least one verifier is required');
    }

    const type = data.type ?? 'expiring';
    const mode = data.mode ?? (type === 'qms' ? null : 'period');

    await executeTx(this.db, async (trx) => {
      const verification = await this.pageVerificationRepo.insert(
        {
          pageId: page.id,
          workspaceId,
          spaceId: page.spaceId,
          type,
          status: type === 'qms' ? 'draft' : null,
          mode,
          periodAmount: data.periodAmount ?? null,
          periodUnit: data.periodUnit ?? null,
          expiresAt:
            mode === 'fixed' && data.fixedExpiresAt
              ? new Date(data.fixedExpiresAt)
              : null,
          creatorId: user.id,
        },
        trx,
      );

      await this.pageVerificationRepo.replaceVerifiers(
        verification.id,
        data.verifierIds,
        user.id,
        trx,
      );
    });
  }

  async update(
    data: {
      pageId: string;
      mode?: string;
      periodAmount?: number;
      periodUnit?: string;
      fixedExpiresAt?: string;
      verifierIds?: string[];
    },
    user: User,
  ) {
    const page = await this.getPageOrThrow(data.pageId);
    const verification = await this.pageVerificationRepo.findByPageId(
      data.pageId,
    );
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }

    const updates: Record<string, unknown> = {};
    if (data.mode !== undefined) updates.mode = data.mode;
    if (data.periodAmount !== undefined) updates.periodAmount = data.periodAmount;
    if (data.periodUnit !== undefined) updates.periodUnit = data.periodUnit;
    if (data.mode === 'fixed' && data.fixedExpiresAt) {
      updates.expiresAt = new Date(data.fixedExpiresAt);
    }

    await executeTx(this.db, async (trx) => {
      if (Object.keys(updates).length > 0) {
        await this.pageVerificationRepo.update(data.pageId, updates, trx);
      }
      if (data.verifierIds) {
        await this.pageVerificationRepo.replaceVerifiers(
          verification.id,
          data.verifierIds,
          user.id,
          trx,
        );
      }
    });
  }

  async remove(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }
    await this.pageVerificationRepo.delete(pageId);
  }

  async verify(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    const verification = await this.pageVerificationRepo.findByPageId(pageId);
    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const isVerifier = await this.pageVerificationRepo.isVerifier(
      verification.id,
      user.id,
    );
    if (!isVerifier) {
      throw new ForbiddenException();
    }

    const now = new Date();

    if (verification.type === 'qms') {
      if (verification.status !== 'in_approval') {
        throw new BadRequestException('Page is not awaiting approval');
      }
      await this.pageVerificationRepo.update(pageId, {
        status: 'approved',
        verifiedAt: now,
        verifiedById: user.id,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
      });
      return;
    }

    const expiresAt = this.computeExpiresAt({
      mode: verification.mode,
      periodAmount: verification.periodAmount,
      periodUnit: verification.periodUnit,
      from: now,
    });

    await this.pageVerificationRepo.update(pageId, {
      verifiedAt: now,
      verifiedById: user.id,
      expiresAt,
      status: null,
    });
  }

  async submitForApproval(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    const verification = await this.pageVerificationRepo.findByPageId(pageId);
    if (!verification || verification.type !== 'qms') {
      throw new BadRequestException('QMS verification required');
    }
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }
    if (verification.status !== 'draft') {
      throw new BadRequestException('Page is not in draft status');
    }

    await this.pageVerificationRepo.update(pageId, {
      status: 'in_approval',
      requestedAt: new Date(),
      requestedById: user.id,
      rejectedAt: null,
      rejectedById: null,
      rejectionComment: null,
    });

    await this.notificationQueue.add(
      QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION,
      {
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: verification.workspaceId,
        actorId: user.id,
        verifierIds: (
          await this.pageVerificationRepo.getVerifiers(verification.id)
        ).map((v) => v.id),
      },
    );
  }

  async rejectApproval(
    data: { pageId: string; comment?: string },
    user: User,
  ) {
    const verification = await this.pageVerificationRepo.findByPageId(
      data.pageId,
    );
    if (!verification || verification.type !== 'qms') {
      throw new NotFoundException('Verification not found');
    }

    const isVerifier = await this.pageVerificationRepo.isVerifier(
      verification.id,
      user.id,
    );
    if (!isVerifier) {
      throw new ForbiddenException();
    }
    if (verification.status !== 'in_approval') {
      throw new BadRequestException('Page is not in approval');
    }

    await this.pageVerificationRepo.update(data.pageId, {
      status: 'draft',
      rejectedAt: new Date(),
      rejectedById: user.id,
      rejectionComment: data.comment ?? null,
    });

    await this.notificationQueue.add(
      QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION,
      {
        pageId: verification.pageId,
        spaceId: verification.spaceId,
        workspaceId: verification.workspaceId,
        actorId: user.id,
        requestedById: verification.requestedById,
        comment: data.comment,
      },
    );
  }

  async markObsolete(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    const verification = await this.pageVerificationRepo.findByPageId(pageId);
    if (!verification || verification.type !== 'qms') {
      throw new NotFoundException('Verification not found');
    }
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException();
    }
    if (verification.status !== 'approved') {
      throw new BadRequestException('Only approved documents can be obsolete');
    }

    await this.pageVerificationRepo.update(pageId, { status: 'obsolete' });
  }

  async list(
    workspaceId: string,
    userId: string,
    pagination: PaginationOptions,
    filters: {
      spaceIds?: string[];
      verifierId?: string;
      type?: string;
    },
  ) {
    const accessibleSpaceIds =
      await this.spaceMemberRepo.getUserSpaceIds(userId);
    const result = await this.pageVerificationRepo.listVerifications(
      workspaceId,
      accessibleSpaceIds,
      pagination,
      filters,
    );

    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        status: this.resolveStatus({
          type: item.type,
          status: item.status,
          verifiedAt: item.verifiedAt,
          expiresAt: item.expiresAt,
        }),
        verifiedAt: item.verifiedAt
          ? new Date(item.verifiedAt).toISOString()
          : null,
        expiresAt: item.expiresAt
          ? new Date(item.expiresAt).toISOString()
          : null,
        createdAt: new Date(item.createdAt).toISOString(),
      })),
    };
  }
}
