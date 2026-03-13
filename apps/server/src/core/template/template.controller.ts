import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TemplateService } from './services/template.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateIdDto } from './dto/template-id.dto';
import { UseTemplateDto } from './dto/use-template.dto';
import { TemplateListDto } from './dto/template-list.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly templateRepo: TemplateRepo,
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getTemplates(
    @Body() dto: TemplateListDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.getTemplates(
      user.id,
      workspace.id,
      pagination,
      dto.spaceId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getTemplate(
    @Body() dto: TemplateIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const template = await this.templateService.getTemplateById(
      dto.templateId,
      workspace.id,
    );
    await this.validateTemplateReadAccess(user.id, template.spaceId);
    return template;
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.validateTemplateWriteAccess(user, workspace, dto.spaceId);
    return this.templateService.createTemplate(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateTemplate(
    @Body() dto: UpdateTemplateDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspace.id,
    );
    if (!template) {
      throw new ForbiddenException();
    }
    await this.validateTemplateWriteAccess(user, workspace, template.spaceId);
    return this.templateService.updateTemplate(user.id, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteTemplate(
    @Body() dto: TemplateIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspace.id,
    );
    if (!template) {
      throw new ForbiddenException();
    }
    await this.validateTemplateWriteAccess(user, workspace, template.spaceId);
    return this.templateService.deleteTemplate(dto.templateId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('use')
  async useTemplate(
    @Body() dto: UseTemplateDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const template = await this.templateRepo.findById(
      dto.templateId,
      workspace.id,
    );
    if (!template) {
      throw new ForbiddenException();
    }
    await this.validateTemplateReadAccess(user.id, template.spaceId);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return this.templateService.useTemplate(user.id, workspace.id, dto);
  }

  private async validateTemplateReadAccess(
    userId: string,
    spaceId?: string | null,
  ) {
    if (!spaceId) return;
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
    if (!userSpaceIds.includes(spaceId)) {
      throw new ForbiddenException();
    }
  }

  private async validateTemplateWriteAccess(
    user: User,
    workspace: Workspace,
    spaceId?: string | null,
  ) {
    if (!spaceId) {
      const wsAbility = this.workspaceAbility.createForUser(user, workspace);
      if (
        wsAbility.cannot(
          WorkspaceCaslAction.Manage,
          WorkspaceCaslSubject.Settings,
        )
      ) {
        throw new ForbiddenException();
      }
      return;
    }

    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      return;
    }

    const space = await this.spaceRepo.findById(spaceId, workspace.id);
    const settings = (space?.settings ?? {}) as Record<string, any>;
    if (
      settings?.allowMemberTemplates &&
      ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)
    ) {
      return;
    }

    throw new ForbiddenException();
  }
}
