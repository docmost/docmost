import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { LicenseService } from './license.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

class ActivateLicenseDto {
  licenseKey: string;
}

@UseGuards(JwtAuthGuard)
@Controller('license')
export class LicenseController {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly licenseService: LicenseService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }

    const licenseKey =
      workspace.licenseKey ||
      (await this.workspaceRepo.findLicenseKeyById(workspace.id));

    return this.licenseService.getLicenseInfo(workspace.id, licenseKey);
  }

  @HttpCode(HttpStatus.OK)
  @Post('activate')
  async activate(
    @Body() dto: ActivateLicenseDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }

    await this.workspaceRepo.updateWorkspace(
      { licenseKey: dto.licenseKey?.trim() || null },
      workspace.id,
    );

    this.auditService.log({
      event: AuditEvent.LICENSE_ACTIVATED,
      resourceType: AuditResource.LICENSE,
      resourceId: workspace.id,
    });

    return this.licenseService.getLicenseInfo(workspace.id, dto.licenseKey);
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove')
  async remove(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }

    await this.workspaceRepo.updateWorkspace({ licenseKey: null }, workspace.id);

    this.auditService.log({
      event: AuditEvent.LICENSE_REMOVED,
      resourceType: AuditResource.LICENSE,
      resourceId: workspace.id,
    });
  }
}

