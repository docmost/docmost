import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { ApiKeyScope } from '../../common/decorators/api-key-scope.decorator';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import { UserProfileService } from './user-profile.service';
import { UserIdDto } from './dto/user-id.dto';
import { ProfileViewer } from './user.types';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly userProfileService: UserProfileService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('me')
  @OAuthScope('read')
  async getUserInfo(
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const memberCount = await this.workspaceRepo.getActiveUserCount(
      workspace.id,
    );

    const { licenseKey, ...rest } = workspace;

    const workspaceInfo = {
      ...rest,
      memberCount,
    };

    return { user: authUser, workspace: workspaceInfo };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.userService.update(updateUserDto, user.id, workspace);
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getUserProfile(
    @Body() dto: UserIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const viewer = this.resolveProfileViewer(user, workspace);
    return this.userProfileService.getProfile(dto.userId, viewer);
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('spaces')
  async getUserSpaces(
    @Body() dto: UserIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const viewer = this.resolveProfileViewer(user, workspace);
    return this.userProfileService.getSpaces(dto.userId, viewer, pagination);
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('recent-pages')
  async getUserRecentPages(
    @Body() dto: UserIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const viewer = this.resolveProfileViewer(user, workspace);
    return this.userProfileService.getRecentPages(
      dto.userId,
      viewer,
      pagination,
    );
  }

  private resolveProfileViewer(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    const viewer: ProfileViewer = {
      userId: user.id,
      workspaceId: workspace.id,
      canManageMembers: ability.can(
        WorkspaceCaslAction.Manage,
        WorkspaceCaslSubject.Member,
      ),
    };

    return viewer;
  }
}
