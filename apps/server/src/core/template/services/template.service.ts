import { Injectable, NotFoundException } from '@nestjs/common';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { UseTemplateDto } from '../dto/use-template.dto';
import { Template } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageService } from '../../page/services/page.service';
import { generateSlugId } from '../../../common/helpers';

@Injectable()
export class TemplateService {
  constructor(
    private templateRepo: TemplateRepo,
    private pageRepo: PageRepo,
    private pageService: PageService,
    private spaceMemberRepo: SpaceMemberRepo,
  ) {}

  async getTemplates(
    userId: string,
    workspaceId: string,
    pagination: PaginationOptions,
    spaceId?: string,
  ) {
    const userSpaces = await this.spaceMemberRepo.getUserSpaceIds(userId);
    return this.templateRepo.findTemplates(
      workspaceId,
      userSpaces,
      pagination,
      { spaceId },
    );
  }

  async getTemplateById(
    templateId: string,
    workspaceId: string,
  ): Promise<Template> {
    const template = await this.templateRepo.findById(templateId, workspaceId, {
      includeContent: true,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async createTemplate(
    userId: string,
    workspaceId: string,
    dto: CreateTemplateDto,
  ): Promise<Template> {
    const template = await this.templateRepo.insertTemplate({
      title: dto.title,
      description: dto.description,
      content: dto.content,
      icon: dto.icon,
      spaceId: dto.spaceId ?? null,
      workspaceId,
      creatorId: userId,
      lastUpdatedById: userId,
      collaboratorIds: [userId],
    });
    return this.templateRepo.findById(template.id, workspaceId, {
      includeContent: true,
    });
  }

  async updateTemplate(
    userId: string,
    workspaceId: string,
    dto: UpdateTemplateDto,
  ): Promise<Template> {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspaceId,
    );
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    const collaboratorIds = template.collaboratorIds ?? [];
    if (!collaboratorIds.includes(userId)) {
      collaboratorIds.push(userId);
    }

    await this.templateRepo.updateTemplate(
      {
        title: dto.title,
        description: dto.description,
        content: dto.content,
        icon: dto.icon,
        lastUpdatedById: userId,
        collaboratorIds,
      },
      dto.templateId,
      workspaceId,
    );
    return this.templateRepo.findById(dto.templateId, workspaceId);
  }

  async deleteTemplate(templateId: string, workspaceId: string): Promise<void> {
    const template = await this.templateRepo.findById(templateId, workspaceId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.templateRepo.deleteTemplate(templateId, workspaceId);
  }

  async useTemplate(userId: string, workspaceId: string, dto: UseTemplateDto) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspaceId,
      { includeContent: true },
    );

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const content = template.content;

    const parentPageId = dto.parentPageId ?? null;
    const position = await this.pageService.nextPagePosition(
      dto.spaceId,
      parentPageId,
    );

    return this.pageRepo.insertPage({
      slugId: generateSlugId(),
      title: template.title ?? 'Untitled',
      icon: template.icon,
      position,
      spaceId: dto.spaceId,
      parentPageId,
      creatorId: userId,
      lastUpdatedById: userId,
      workspaceId,
      content,
    });
  }
}
