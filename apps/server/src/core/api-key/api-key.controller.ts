import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    const isAdmin = ability.can(
      WorkspaceCaslAction.Manage,
      WorkspaceCaslSubject.API,
    );
    // admins may list every key in the workspace via adminView; others see their own
    const creatorId = isAdmin && pagination.adminView ? undefined : user.id;
    return this.apiKeyService.getApiKeys(workspace.id, pagination, {
      creatorId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Create, WorkspaceCaslSubject.API)) {
      throw new ForbiddenException();
    }
    return this.apiKeyService.createApiKey(user, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    const isAdmin = ability.can(
      WorkspaceCaslAction.Manage,
      WorkspaceCaslSubject.API,
    );
    return this.apiKeyService.updateApiKey(workspace.id, dto, {
      creatorId: isAdmin ? undefined : user.id,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revoke(
    @Body() dto: RevokeApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    const isAdmin = ability.can(
      WorkspaceCaslAction.Manage,
      WorkspaceCaslSubject.API,
    );
    await this.apiKeyService.revokeApiKey(workspace.id, dto.apiKeyId, {
      creatorId: isAdmin ? undefined : user.id,
    });
  }
}
