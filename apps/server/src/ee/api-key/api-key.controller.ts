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
import { ApiKeyService } from './api-key.service';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @RequireFeature(Feature.API_KEYS)
  async list(
    @Body() pagination: PaginationOptions,
    @Body('adminView') adminView: boolean,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (adminView) {
      const ability = this.workspaceAbility.createForUser(user, workspace);
      if (
        ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
      ) {
        throw new ForbiddenException();
      }
    }

    return this.apiKeyService.list(
      workspace.id,
      user.id,
      pagination,
      adminView,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @RequireFeature(Feature.API_KEYS)
  async create(
    @Body() body: { name: string; expiresAt?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.create(workspace.id, user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @RequireFeature(Feature.API_KEYS)
  async update(
    @Body() body: { apiKeyId: string; name: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    const isAdmin = ability.can(
      WorkspaceCaslAction.Manage,
      WorkspaceCaslSubject.Settings,
    );
    return this.apiKeyService.update(workspace.id, user.id, body, isAdmin);
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  @RequireFeature(Feature.API_KEYS)
  async revoke(
    @Body() body: { apiKeyId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    const isAdmin = ability.can(
      WorkspaceCaslAction.Manage,
      WorkspaceCaslSubject.Settings,
    );
    await this.apiKeyService.revoke(
      workspace.id,
      user.id,
      body.apiKeyId,
      isAdmin,
    );
    return { success: true };
  }
}
