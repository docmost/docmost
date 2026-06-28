import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { TemplateService } from './template.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @RequireFeature(Feature.TEMPLATES)
  async list(
    @Body() body: PaginationOptions & { spaceId?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const { spaceId, ...pagination } = body;
    return this.templateService.list(workspace.id, user.id, pagination, {
      spaceId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  @RequireFeature(Feature.TEMPLATES)
  async info(
    @Body() body: { templateId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.getById(body.templateId, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @RequireFeature(Feature.TEMPLATES)
  async create(
    @Body()
    body: {
      title?: string;
      description?: string;
      content?: unknown;
      icon?: string;
      spaceId?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.create(workspace.id, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @RequireFeature(Feature.TEMPLATES)
  async update(
    @Body()
    body: {
      templateId: string;
      title?: string;
      description?: string;
      content?: unknown;
      icon?: string;
      spaceId?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.update(workspace.id, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  @RequireFeature(Feature.TEMPLATES)
  async delete(
    @Body() body: { templateId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.templateService.delete(body.templateId, workspace.id, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('use')
  @RequireFeature(Feature.TEMPLATES)
  async use(
    @Body()
    body: { templateId: string; spaceId: string; parentPageId?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.useTemplate(workspace.id, user, body);
  }
}
