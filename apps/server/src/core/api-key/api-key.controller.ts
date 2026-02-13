import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './services/api-key.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  RevokeApiKeyDto,
} from './dto/api-key.dto';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import { UserRole } from '../../common/helpers/types/permission';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async listApiKeys(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (pagination.adminView) {
      const ability = this.workspaceAbility.createForUser(user, workspace);
      if (
        ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.API)
      ) {
        throw new ForbiddenException();
      }
      return this.apiKeyService.getWorkspaceApiKeys(workspace.id, pagination);
    }

    return this.apiKeyService.getApiKeys(user.id, workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Create, WorkspaceCaslSubject.API)
    ) {
      throw new ForbiddenException();
    }

    return this.apiKeyService.createApiKey({
      name: dto.name,
      expiresAt: dto.expiresAt,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateApiKey(
    @Body() dto: UpdateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.updateApiKey(
      dto.apiKeyId,
      dto.name,
      workspace.id,
      user.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revokeApiKey(
    @Body() dto: RevokeApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.OWNER;

    return this.apiKeyService.revokeApiKey(
      dto.apiKeyId,
      workspace.id,
      user.id,
      isAdmin,
    );
  }
}
