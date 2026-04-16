import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { PageService } from '../../core/page/services/page.service';

@Injectable()
export class TemplateService {
  constructor(
    private readonly templateRepo: TemplateRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pageService: PageService,
  ) {}

  async listTemplates(
    workspaceId: string,
    userId: string,
    pagination: { spaceId?: string; cursor?: string; beforeCursor?: string; limit?: number; query?: string },
  ) {
    const accessibleSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
    return this.templateRepo.findTemplates(
      workspaceId,
      accessibleSpaceIds,
      {
        limit: pagination.limit ?? 20,
        cursor: pagination.cursor,
        beforeCursor: pagination.beforeCursor,
        query: pagination.query,
        adminView: false,
      },
      {
        spaceId: pagination.spaceId,
      },
    );
  }

  async getTemplate(templateId: string, workspaceId: string, userId: string) {
    const accessibleSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
    const template = await this.templateRepo.findById(templateId, workspaceId, {
      includeContent: true,
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.spaceId && !accessibleSpaceIds.includes(template.spaceId)) {
      throw new ForbiddenException();
    }

    return template;
  }

  async createTemplate(
    workspace: Workspace,
    user: User,
    data: { title?: string; description?: string; icon?: string; spaceId?: string; content?: any },
  ) {
    await this.assertCanManageScope(workspace, user, data.spaceId);

    const result = await this.templateRepo.insertTemplate({
      title: data.title ?? 'Untitled',
      description: data.description ?? null,
      icon: data.icon ?? null,
      content: data.content ?? null,
      spaceId: data.spaceId ?? null,
      workspaceId: workspace.id,
      creatorId: user.id,
      lastUpdatedById: user.id,
    });

    return this.templateRepo.findById(result.id, workspace.id, {
      includeContent: true,
    });
  }

  async updateTemplate(
    workspace: Workspace,
    user: User,
    data: { templateId: string; title?: string; description?: string; icon?: string; spaceId?: string; content?: any },
  ) {
    const template = await this.templateRepo.findById(data.templateId, workspace.id, {
      includeContent: true,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertCanModifyTemplate(workspace, user, template);
    await this.assertCanManageScope(workspace, user, data.spaceId ?? template.spaceId);

    await this.templateRepo.updateTemplate(
      {
        title: data.title,
        description: data.description,
        icon: data.icon,
        content: data.content,
        spaceId: data.spaceId ?? null,
        lastUpdatedById: user.id,
      },
      template.id,
      workspace.id,
    );

    return this.templateRepo.findById(template.id, workspace.id, {
      includeContent: true,
    });
  }

  async deleteTemplate(workspace: Workspace, user: User, templateId: string) {
    const template = await this.templateRepo.findById(templateId, workspace.id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.assertCanModifyTemplate(workspace, user, template);
    await this.templateRepo.deleteTemplate(templateId, workspace.id);
  }

  async useTemplate(
    workspace: Workspace,
    user: User,
    data: { templateId: string; spaceId: string; parentPageId?: string },
  ) {
    const template = await this.templateRepo.findById(data.templateId, workspace.id, {
      includeContent: true,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const ability = await this.spaceAbility.createForUser(user, data.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.pageService.create(user.id, workspace.id, {
      title: template.title ?? 'Untitled',
      icon: template.icon ?? undefined,
      parentPageId: data.parentPageId,
      spaceId: data.spaceId,
      content:
        typeof template.content === 'string' ||
        (template.content && typeof template.content === 'object')
          ? template.content
          : undefined,
      format:
        typeof template.content === 'string' ||
        (template.content && typeof template.content === 'object')
          ? 'json'
          : undefined,
    });
  }

  private async assertCanManageScope(
    workspace: Workspace,
    user: User,
    spaceId?: string | null,
  ): Promise<void> {
    if (!spaceId) {
      const ability = this.workspaceAbility.createForUser(user, workspace);
      if (
        ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
      ) {
        throw new ForbiddenException();
      }
      return;
    }

    const settings = workspace.settings as Record<string, any> | null;
    const allowMemberTemplates = settings?.templates?.allowMemberTemplates === true;
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    const canManageSpacePages = ability.can(
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    );

    if (!canManageSpacePages) {
      throw new ForbiddenException();
    }

    if (!allowMemberTemplates && user.role === 'member') {
      throw new ForbiddenException('Member templates are disabled');
    }
  }

  private async assertCanModifyTemplate(
    workspace: Workspace,
    user: User,
    template: { creatorId?: string; spaceId?: string | null },
  ): Promise<void> {
    const workspaceAbility = this.workspaceAbility.createForUser(user, workspace);
    if (
      workspaceAbility.can(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      return;
    }

    if (template.creatorId !== user.id) {
      throw new ForbiddenException();
    }

    if (!template.spaceId) {
      throw new ForbiddenException();
    }

    await this.assertCanManageScope(workspace, user, template.spaceId);
  }
}
