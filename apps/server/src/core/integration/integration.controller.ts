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
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { IntegrationService } from './integration.service';
import { IntegrationConnectionService } from './integration-connection.service';
import {
  InstallIntegrationDto,
  UninstallIntegrationDto,
  IntegrationIdDto,
} from './dto/integration.dto';
import { IntegrationRegistry } from './registry/integration-registry';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { Feature } from '../../common/features';

@Controller('integrations')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly licenseCheckService: LicenseCheckService,
    private readonly registry: IntegrationRegistry,
  ) {}

  private assertIntegrationsLicensed(workspace: Workspace) {
    if (
      !this.licenseCheckService.hasFeature(
        workspace.licenseKey,
        Feature.INTEGRATIONS,
        workspace.plan,
      )
    ) {
      throw new ForbiddenException('This feature requires a valid license');
    }
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('available')
  async getAvailableIntegrations() {
    return this.integrationService.getAvailableIntegrations();
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('list')
  async getInstalledIntegrations(
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.integrationService.getInstalledIntegrations(workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('install')
  async install(
    @Body() dto: InstallIntegrationDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(
        WorkspaceCaslAction.Manage,
        WorkspaceCaslSubject.Settings,
      )
    ) {
      throw new ForbiddenException();
    }

    if (this.registry.getProvider(dto.type)?.definition.requiresLicense) {
      this.assertIntegrationsLicensed(workspace);
    }
    return this.integrationService.install(dto.type, workspace.id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('uninstall')
  async uninstall(
    @Body() dto: UninstallIntegrationDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(
        WorkspaceCaslAction.Manage,
        WorkspaceCaslSubject.Settings,
      )
    ) {
      throw new ForbiddenException();
    }

    await this.integrationService.uninstall(dto.integrationId, workspace.id);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('connections/mine')
  async getMyConnections(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.connectionService.getUserConnections(user.id, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('connection/status')
  async getConnectionStatus(
    @Body() dto: IntegrationIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.connectionService.getConnectionStatus(
      dto.integrationId,
      user.id,
      workspace.id,
    );
  }
}
