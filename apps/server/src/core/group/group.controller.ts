import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { GroupService } from './services/group.service.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { AuthUser } from '../../common/decorators/auth-user.decorator.js';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator.js';
import { GroupUserService } from './services/group-user.service.js';
import { GroupIdDto } from './dto/group-id.dto.js';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options.js';
import { AddGroupUserDto } from './dto/add-group-user.dto.js';
import { RemoveGroupUserDto } from './dto/remove-group-user.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory.js';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type.js';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly groupUserService: GroupUserService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  getWorkspaceGroups(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Group)) {
      throw new ForbiddenException();
    }

    return this.groupService.getWorkspaceGroups(workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  getGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Group)) {
      throw new ForbiddenException();
    }
    return this.groupService.getGroupInfo(groupIdDto.groupId, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group)
    ) {
      throw new ForbiddenException();
    }
    return this.groupService.createGroup(user, workspace.id, createGroupDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  updateGroup(
    @Body() updateGroupDto: UpdateGroupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group)
    ) {
      throw new ForbiddenException();
    }

    return this.groupService.updateGroup(workspace.id, updateGroupDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('members')
  getGroupMembers(
    @Body() groupIdDto: GroupIdDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Group)) {
      throw new ForbiddenException();
    }

    return this.groupUserService.getGroupUsers(
      groupIdDto.groupId,
      workspace.id,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  addGroupMember(
    @Body() addGroupUserDto: AddGroupUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group)
    ) {
      throw new ForbiddenException();
    }

    return this.groupUserService.addUsersToGroupBatch(
      addGroupUserDto.userIds,
      addGroupUserDto.groupId,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  removeGroupMember(
    @Body() removeGroupUserDto: RemoveGroupUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group)
    ) {
      throw new ForbiddenException();
    }

    return this.groupUserService.removeUserFromGroup(
      removeGroupUserDto.userId,
      removeGroupUserDto.groupId,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  deleteGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Group)
    ) {
      throw new ForbiddenException();
    }
    return this.groupService.deleteGroup(groupIdDto.groupId, workspace.id);
  }
}
