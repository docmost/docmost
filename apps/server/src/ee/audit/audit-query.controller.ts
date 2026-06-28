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
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuditQueryService } from './audit-query.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditQueryController {
  constructor(
    private readonly auditQueryService: AuditQueryService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  private assertOwner(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  @RequireFeature(Feature.AUDIT_LOGS)
  async query(
    @Body() body: PaginationOptions & Record<string, any>,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertOwner(user, workspace);
    const { limit, cursor, beforeCursor, ...filters } = body;
    const pagination = new PaginationOptions();
    pagination.limit = limit ?? pagination.limit;
    pagination.cursor = cursor;
    pagination.beforeCursor = beforeCursor;

    return this.auditQueryService.queryLogs(workspace.id, pagination, filters);
  }

  @HttpCode(HttpStatus.OK)
  @Post('retention')
  @RequireFeature(Feature.AUDIT_LOGS)
  async getRetention(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertOwner(user, workspace);
    return this.auditQueryService.getRetention(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('retention/update')
  @RequireFeature(Feature.AUDIT_LOGS)
  async updateRetention(
    @Body() body: { auditRetentionDays: number },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertOwner(user, workspace);
    return this.auditQueryService.updateRetention(
      workspace.id,
      body.auditRetentionDays,
    );
  }
}
