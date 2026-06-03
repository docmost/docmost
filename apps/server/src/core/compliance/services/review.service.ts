import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewRepo } from '@docmost/db/repos/compliance/review.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { ReviewSetting, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { emptyCursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { MarkReviewedDto, ReviewScopeDto, SetReviewDto } from '../dto/review.dto';
import { REVIEW_DUE_WARNING_DAYS, ReviewStatus } from '../compliance.constants';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepo: ReviewRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async get(scope: ReviewScopeDto, user: User) {
    const { spaceId, pageId, isPage } = await this.resolveScope(scope);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    const setting = isPage
      ? await this.reviewRepo.resolveEffective(pageId, spaceId)
      : await this.reviewRepo.findByScope({ spaceId });

    if (!setting) {
      return { setting: null, status: null, inherited: false };
    }

    const inherited = isPage ? setting.pageId !== pageId : false;

    return { setting, status: this.computeStatus(setting), inherited };
  }

  async set(dto: SetReviewDto, user: User, workspaceId: string) {
    const { spaceId, pageId, isPage } = await this.resolveScope(dto);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Settings,
    );

    const existing = await this.reviewRepo.findByScope(
      isPage ? { pageId } : { spaceId },
    );

    if (existing) {
      const base = existing.lastReviewedAt
        ? new Date(existing.lastReviewedAt)
        : new Date();
      return this.reviewRepo.updateSetting(
        {
          intervalDays: dto.intervalDays,
          nextReviewAt: this.addDays(base, dto.intervalDays),
        },
        existing.id,
      );
    }

    return this.reviewRepo.insertSetting({
      pageId: isPage ? pageId : null,
      spaceId: isPage ? null : spaceId,
      workspaceId,
      intervalDays: dto.intervalDays,
      nextReviewAt: this.addDays(new Date(), dto.intervalDays),
    });
  }

  async markReviewed(dto: MarkReviewedDto, user: User, workspaceId: string) {
    const { spaceId, pageId, isPage } = await this.resolveScope(dto);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    );

    const setting = await this.reviewRepo.findByScope(
      isPage ? { pageId } : { spaceId },
    );
    if (!setting) {
      throw new NotFoundException('Review setting not found');
    }

    const now = new Date();

    const updated = await this.reviewRepo.updateSetting(
      {
        lastReviewedAt: now,
        lastReviewedById: user.id,
        nextReviewAt: this.addDays(now, setting.intervalDays),
      },
      setting.id,
    );

    await this.reviewRepo.insertRecord({
      reviewSettingId: setting.id,
      pageId: isPage ? pageId : null,
      spaceId: isPage ? null : spaceId,
      workspaceId,
      reviewedById: user.id,
      note: dto.note,
    });

    return { setting: updated, status: this.computeStatus(updated), inherited: false };
  }

  async history(
    scope: ReviewScopeDto,
    pagination: PaginationOptions,
    user: User,
  ) {
    const { spaceId, pageId, isPage } = await this.resolveScope(scope);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    const setting = await this.reviewRepo.findByScope(
      isPage ? { pageId } : { spaceId },
    );
    if (!setting) {
      return emptyCursorPaginationResult(pagination.limit);
    }

    return this.reviewRepo.findRecords(setting.id, pagination);
  }

  async getStatuses(
    spaceId: string,
    user: User,
  ): Promise<Record<string, ReviewStatus>> {
    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    const rows = await this.reviewRepo.findPageSettingsBySpace(spaceId);

    const result: Record<string, ReviewStatus> = {};
    for (const row of rows) {
      result[row.pageId] = this.computeStatus({
        nextReviewAt: row.nextReviewAt,
      } as ReviewSetting);
    }
    return result;
  }

  private computeStatus(setting: ReviewSetting): ReviewStatus {
    if (!setting.nextReviewAt) {
      return ReviewStatus.Ok;
    }

    const now = Date.now();
    const next = new Date(setting.nextReviewAt).getTime();

    if (now > next) {
      return ReviewStatus.Overdue;
    }

    const warnWindow = REVIEW_DUE_WARNING_DAYS * 24 * 60 * 60 * 1000;
    if (next - now <= warnWindow) {
      return ReviewStatus.Due;
    }

    return ReviewStatus.Ok;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private async resolveScope(scope: {
    pageId?: string;
    spaceId?: string;
  }): Promise<{ spaceId: string; pageId?: string; isPage: boolean }> {
    if (scope.pageId) {
      const page = await this.pageRepo.findById(scope.pageId);
      if (!page) {
        throw new NotFoundException('Page not found');
      }
      return { spaceId: page.spaceId, pageId: page.id, isPage: true };
    }

    if (scope.spaceId) {
      return { spaceId: scope.spaceId, isPage: false };
    }

    throw new BadRequestException('pageId or spaceId is required');
  }

  private async assertAbility(
    user: User,
    spaceId: string,
    action: SpaceCaslAction,
    subject: SpaceCaslSubject,
  ) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(action, subject)) {
      throw new ForbiddenException();
    }
  }
}
