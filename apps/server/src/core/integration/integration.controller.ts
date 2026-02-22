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
  UpdateIntegrationDto,
  IntegrationIdDto,
} from './dto/integration.dto';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';

@Controller('integrations')
export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

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
  @Post('update')
  async update(
    @Body() dto: UpdateIntegrationDto,
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

    return this.integrationService.update(dto.integrationId, workspace.id, {
      settings: dto.settings,
      isEnabled: dto.isEnabled,
    });
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
