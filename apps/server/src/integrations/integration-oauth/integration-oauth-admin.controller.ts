import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
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
import { IntegrationOAuthRegistry } from './manifest.registry';
import {
  IntegrationOAuthConnectionService,
  PublicIntegrationOAuthConnection,
} from './integration-oauth-connection.service';
import { SaveIntegrationOAuthConnectionDto } from './dto/save-integration-oauth-connection.dto';

@Controller('integrations/oauth/admin/connections')
@UseGuards(JwtAuthGuard)
export class IntegrationOAuthAdminController {
  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly connectionService: IntegrationOAuthConnectionService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @Get()
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<PublicIntegrationOAuthConnection[]> {
    this.requireAdmin(user, workspace);
    return this.connectionService.listAdmin(workspace.id);
  }

  @Put(':integrationId')
  async save(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('integrationId') integrationId: string,
    @Body() body: SaveIntegrationOAuthConnectionDto,
  ): Promise<PublicIntegrationOAuthConnection> {
    this.requireAdmin(user, workspace);
    if (!this.registry.getForIntegrationId(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    return this.connectionService.save(
      workspace.id,
      integrationId,
      user.id,
      body,
    );
  }

  private requireAdmin(user: User, workspace: Workspace): void {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }
}
