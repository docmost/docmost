import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { ChangeSetRepo } from '@docmost/db/repos/compliance/change-set.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { CreateChangeSetDto } from '../dto/create-change-set.dto';
import {
  ChangeSetScopeDto,
  SetChangeLogSettingsDto,
} from '../dto/change-set.dto';

@Injectable()
export class ChangeSetService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly changeSetRepo: ChangeSetRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  async create(dto: CreateChangeSetDto, user: User, workspaceId: string) {
    const { spaceId, pageId, isPage } = await this.resolveScope(dto);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    );

    if (dto.correctsId) {
      const corrected = await this.changeSetRepo.findById(dto.correctsId);
      if (!corrected || corrected.workspaceId !== workspaceId) {
        throw new NotFoundException('Change set not found');
      }
    }

    const changeSet = await executeTx(this.db, async (trx) => {
      const created = await this.changeSetRepo.insertChangeSet(
        {
          pageId: isPage ? pageId : null,
          spaceId: isPage ? null : spaceId,
          workspaceId,
          reason: dto.reason,
          requestedBy: dto.requestedBy,
          targetSystem: dto.targetSystem,
          ticketRef: dto.ticketRef,
          performedById: user.id,
          correctsId: dto.correctsId,
        },
        trx,
      );

      await this.changeSetRepo.insertChangeEntries(
        dto.entries.map((entry, index) => ({
          changeSetId: created.id,
          summary: entry.summary,
          detail: entry.detail,
          position: index,
        })),
        trx,
      );

      return created;
    });

    return this.changeSetRepo.findById(changeSet.id);
  }

  async list(
    scope: ChangeSetScopeDto,
    pagination: PaginationOptions,
    user: User,
  ) {
    const { spaceId } = await this.resolveScope(scope);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    return this.changeSetRepo.findByScope(scope, pagination);
  }

  async findOne(changeSetId: string, user: User) {
    const changeSet = await this.changeSetRepo.findById(changeSetId);
    if (!changeSet) {
      throw new NotFoundException('Change set not found');
    }

    const { spaceId } = await this.resolveScope({
      pageId: changeSet.pageId ?? undefined,
      spaceId: changeSet.spaceId ?? undefined,
    });

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    return changeSet;
  }

  async getChangeLogInfo(scope: ChangeSetScopeDto, user: User) {
    const { spaceId, pageId, isPage } = await this.resolveScope(scope);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Read,
      SpaceCaslSubject.Page,
    );

    if (!isPage) {
      const setting = await this.changeSetRepo.findSettingByScope({ spaceId });
      return {
        enabled: setting?.enabled ?? false,
        inherited: false,
        undocumented: false,
      };
    }

    const setting = await this.changeSetRepo.resolveEffectiveSetting(
      pageId,
      spaceId,
    );
    const enabled = setting?.enabled ?? false;
    const inherited = !!setting && setting.pageId !== pageId;

    let undocumented = false;
    if (enabled) {
      const page = await this.pageRepo.findById(pageId);
      const latestChangeAt = await this.changeSetRepo.getLatestChangeAt(pageId);
      const baseline = latestChangeAt ?? new Date(setting.createdAt);
      undocumented =
        !!page?.updatedAt && new Date(page.updatedAt) > new Date(baseline);
    }

    return { enabled, inherited, undocumented };
  }

  async setChangeLogSettings(
    dto: SetChangeLogSettingsDto,
    user: User,
    workspaceId: string,
  ) {
    const { spaceId, pageId, isPage } = await this.resolveScope(dto);

    await this.assertAbility(
      user,
      spaceId,
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Settings,
    );

    const existing = await this.changeSetRepo.findSettingByScope(
      isPage ? { pageId } : { spaceId },
    );

    if (existing) {
      return this.changeSetRepo.updateSetting(
        { enabled: dto.enabled },
        existing.id,
      );
    }

    return this.changeSetRepo.insertSetting({
      pageId: isPage ? pageId : null,
      spaceId: isPage ? null : spaceId,
      workspaceId,
      enabled: dto.enabled,
    });
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
