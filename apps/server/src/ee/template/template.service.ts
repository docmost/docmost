import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageService } from '../../core/page/services/page.service';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { ContentFormat } from '../../core/page/dto/create-page.dto';
import { JsonValue } from '@docmost/db/types/db';

@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageService: PageService,
    private readonly pageAccessService: PageAccessService,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    pagination: PaginationOptions,
    opts?: { spaceId?: string },
  ) {
    const accessibleSpaceIds =
      await this.spaceMemberRepo.getUserSpaceIds(userId);
    return this.templateRepo.findTemplates(
      workspaceId,
      accessibleSpaceIds,
      pagination,
      opts,
    );
  }

  async getById(templateId: string, workspaceId: string, userId: string) {
    const template = await this.templateRepo.findById(templateId, workspaceId, {
      includeContent: true,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.assertCanView(template.spaceId, userId);
    return template;
  }

  private async assertCanView(spaceId: string | null, userId: string) {
    if (!spaceId) return;
    const spaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
    if (!spaceIds.includes(spaceId)) {
      throw new ForbiddenException();
    }
  }

  async create(
    workspaceId: string,
    user: User,
    data: {
      title?: string;
      description?: string;
      content?: unknown;
      icon?: string;
      spaceId?: string;
    },
  ) {
    if (data.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        user,
        data.spaceId,
      );
      if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    } else {
      const ability = this.workspaceAbility.createForUser(user, {
        id: workspaceId,
      } as Workspace);
      if (
        ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
      ) {
        throw new ForbiddenException();
      }
    }

    const result = await this.templateRepo.insertTemplate({
      title: data.title ?? 'Untitled',
      description: data.description ?? null,
      content: (data.content as JsonValue) ?? null,
      icon: data.icon ?? null,
      spaceId: data.spaceId ?? null,
      workspaceId,
      creatorId: user.id,
      lastUpdatedById: user.id,
    });

    return this.templateRepo.findById(result.id, workspaceId);
  }

  async update(
    workspaceId: string,
    user: User,
    data: {
      templateId: string;
      title?: string;
      description?: string;
      content?: unknown;
      icon?: string;
      spaceId?: string;
    },
  ) {
    const existing = await this.templateRepo.findById(
      data.templateId,
      workspaceId,
    );
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    await this.assertCanManage(existing, user, workspaceId);

    await this.templateRepo.updateTemplate(
      {
        title: data.title,
        description: data.description,
        content: data.content as JsonValue,
        icon: data.icon,
        lastUpdatedById: user.id,
      },
      data.templateId,
      workspaceId,
    );

    return this.templateRepo.findById(data.templateId, workspaceId, {
      includeContent: true,
    });
  }

  async delete(templateId: string, workspaceId: string, user: User) {
    const existing = await this.templateRepo.findById(templateId, workspaceId);
    if (!existing) {
      throw new NotFoundException('Template not found');
    }
    await this.assertCanManage(existing, user, workspaceId);
    await this.templateRepo.deleteTemplate(templateId, workspaceId);
  }

  async useTemplate(
    workspaceId: string,
    user: User,
    data: { templateId: string; spaceId: string; parentPageId?: string },
  ) {
    const template = await this.templateRepo.findById(
      data.templateId,
      workspaceId,
      { includeContent: true },
    );
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const ability = await this.spaceAbility.createForUser(user, data.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    if (data.parentPageId) {
      const parent = await this.pageRepo.findById(data.parentPageId);
      if (!parent || parent.spaceId !== data.spaceId) {
        throw new NotFoundException('Parent page not found');
      }
      await this.pageAccessService.validateCanEdit(parent, user);
    }

    return this.pageService.create(user.id, workspaceId, {
      title: template.title ?? 'Untitled',
      icon: template.icon ?? undefined,
      spaceId: data.spaceId,
      parentPageId: data.parentPageId,
      content: template.content as object,
      format: 'json' as ContentFormat,
    });
  }

  private async assertCanManage(
    template: { spaceId: string | null; creatorId: string | null },
    user: User,
    workspaceId: string,
  ) {
    if (template.creatorId === user.id) return;

    if (template.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        user,
        template.spaceId,
      );
      if (ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
        return;
      }
    }

    const ability = this.workspaceAbility.createForUser(user, {
      id: workspaceId,
    } as Workspace);
    if (
      ability.can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      return;
    }

    throw new ForbiddenException();
  }
}
