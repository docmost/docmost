import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';
import { SpaceIdDto } from './dto/space-id.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceMemberService } from './services/space-member.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AddSpaceMembersDto } from './dto/add-space-members.dto';
import { RemoveSpaceMemberDto } from './dto/remove-space-member.dto';
import { UpdateSpaceMemberRoleDto } from './dto/update-space-member-role.dto';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { findHighestUserSpaceRole } from '@docmost/db/repos/space/utils';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import { CreateSpaceDto } from './dto/create-space.dto';
import { ListSpacesDto } from './dto/list-spaces.dto';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { ApiKeyScope } from '../../common/decorators/api-key-scope.decorator';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpaceController {
  constructor(
    private readonly spaceService: SpaceService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly spaceRepo: SpaceRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  @OAuthScope('read')
  async getWorkspaceSpaces(@Body() dto: ListSpacesDto, @AuthUser() user: User) {
    const result = await this.spaceMemberService.getUserSpaces(user.id, dto, {
      archived: dto.archived,
    });

    if (result.items.length > 0) {
      const spaceIds = result.items.map((s) => s.id);
      const roles = await this.spaceMemberRepo.getUserRolesForSpaces(
        user.id,
        spaceIds,
      );

      const roleMap = new Map<string, string[]>();
      for (const row of roles) {
        const existing = roleMap.get(row.spaceId) || [];
        existing.push(row.role);
        roleMap.set(row.spaceId, existing);
      }

      result.items = result.items.map((space) => {
        const spaceRoles = roleMap.get(space.id);
        const role = spaceRoles
          ? findHighestUserSpaceRole(
              spaceRoles.map((r) => ({ userId: user.id, role: r })),
            )
          : undefined;

        return {
          ...space,
          membership: { userId: user.id, role },
        };
      });
    }

    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  @OAuthScope('read')
  async getSpaceInfo(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.spaceService.getSpaceInfo(
      spaceIdDto.spaceId,
      workspace.id,
    );

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(
      user.id,
      space.id,
    );

    const userSpaceRole = findHighestUserSpaceRole(userSpaceRoles);

    const membership = {
      userId: user.id,
      role: userSpaceRole,
      permissions: ability.rules,
    };

    const homePage = await this.spaceService.getHomePage(space, user.id);

    return { ...space, membership, homePage };
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  @OAuthScope('write')
  createSpace(
    @Body() createSpaceDto: CreateSpaceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Space)
    ) {
      throw new ForbiddenException();
    }
    return this.spaceService.createSpace(user, workspace.id, createSpaceDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  @OAuthScope('write')
  async updateSpace(
    @Body() updateSpaceDto: UpdateSpaceDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      updateSpaceDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }

    if (updateSpaceDto.homePageId) {
      const canAccessHomePage = await this.pagePermissionRepo.canUserAccessPage(
        user.id,
        updateSpaceDto.homePageId,
      );
      if (!canAccessHomePage) {
        throw new ForbiddenException();
      }
    }

    const updatedSpace = await this.spaceService.updateSpace(
      updateSpaceDto,
      workspace.id,
    );
    const homePage = await this.spaceService.getHomePage(updatedSpace, user.id);

    return { ...updatedSpace, homePage };
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteSpace(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
    return this.spaceService.deleteSpace(spaceIdDto.spaceId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('archive')
  async archiveSpace(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.findManageableSpace(
      spaceIdDto.spaceId,
      user,
      workspace.id,
    );
    return this.spaceService.archiveSpace(space, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('unarchive')
  async unarchiveSpace(
    @Body() spaceIdDto: SpaceIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const space = await this.findManageableSpace(
      spaceIdDto.spaceId,
      user,
      workspace.id,
    );
    return this.spaceService.unarchiveSpace(space);
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getSpaceMembers(
    @Body() spaceIdDto: SpaceIdDto,
    @Body()
    pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = await this.spaceAbility.createForUser(
      user,
      spaceIdDto.spaceId,
    );

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.getSpaceMembers(
      spaceIdDto.spaceId,
      workspace.id,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  async addSpaceMember(
    @Body() dto: AddSpaceMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (!dto.groupIds || dto.groupIds.length === 0)
    ) {
      throw new BadRequestException('userIds or groupIds is required');
    }

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.addMembersToSpaceBatch(
      dto,
      user,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  async removeSpaceMember(
    @Body() dto: RemoveSpaceMemberDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.removeMemberFromSpace(dto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/change-role')
  async updateSpaceMemberRole(
    @Body() dto: UpdateSpaceMemberRoleDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.validateIds(dto);

    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Member)) {
      throw new ForbiddenException();
    }

    return this.spaceMemberService.updateSpaceMemberRole(dto, workspace.id);
  }

  private async findManageableSpace(
    spaceId: string,
    user: User,
    workspaceId: string,
  ) {
    const space = await this.spaceRepo.findById(spaceId, workspaceId, {
      includeArchivedBy: true,
    });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const ability = await this.spaceAbility.createForUser(user, space.id);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Settings)) {
      throw new ForbiddenException();
    }
    return space;
  }

  validateIds(dto: RemoveSpaceMemberDto | UpdateSpaceMemberRoleDto) {
    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }
    if (dto.userId && dto.groupId) {
      throw new BadRequestException(
        'please provide either a userId or groupId and both',
      );
    }
  }
}
