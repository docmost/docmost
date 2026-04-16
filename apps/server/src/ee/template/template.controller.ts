import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TemplateService } from './template.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body()
    body: {
      spaceId?: string;
      cursor?: string;
      beforeCursor?: string;
      limit?: number;
      query?: string;
    },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.listTemplates(workspace.id, user.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() body: { templateId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.getTemplate(body.templateId, workspace.id, user.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const template = await this.templateService.createTemplate(workspace, user, body);
    this.auditService.log({
      event: AuditEvent.PAGE_CREATED,
      resourceType: AuditResource.PAGE,
      resourceId: template.id,
      metadata: { template: true },
    });
    return template;
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.updateTemplate(workspace, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async remove(
    @Body() body: { templateId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.templateService.deleteTemplate(workspace, user, body.templateId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('use')
  async use(
    @Body() body: { templateId: string; spaceId: string; parentPageId?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.templateService.useTemplate(workspace, user, body);
  }
}

