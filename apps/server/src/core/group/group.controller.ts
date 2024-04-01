import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GroupService } from './services/group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { GroupUserService } from './services/group-user.service';
import { GroupIdDto } from './dto/group-id.dto';
import { PaginationOptions } from '../../kysely/pagination/pagination-options';
import { AddGroupUserDto } from './dto/add-group-user.dto';
import { RemoveGroupUserDto } from './dto/remove-group-user.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Action } from '../casl/ability.action';
import { PoliciesGuard } from '../casl/guards/policies.guard';
import { CheckPolicies } from '../casl/decorators/policies.decorator';
import { AppAbility } from '../casl/abilities/casl-ability.factory';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly groupUserService: GroupUserService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  getWorkspaceGroups(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupService.getWorkspaceGroups(workspace.id, pagination);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Read, 'Group'))
  @HttpCode(HttpStatus.OK)
  @Post('/info')
  getGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupService.getGroupInfo(groupIdDto.groupId, workspace.id);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, 'Group'))
  @HttpCode(HttpStatus.OK)
  @Post('create')
  createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupService.createGroup(user, workspace.id, createGroupDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, 'Group'))
  @HttpCode(HttpStatus.OK)
  @Post('update')
  updateGroup(
    @Body() updateGroupDto: UpdateGroupDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupService.updateGroup(workspace.id, updateGroupDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Read, 'GroupUser'))
  @HttpCode(HttpStatus.OK)
  @Post('members')
  getGroupMembers(
    @Body() groupIdDto: GroupIdDto,
    @Body() pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.getGroupUsers(
      groupIdDto.groupId,
      workspace.id,
      pagination,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'GroupUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  addGroupMember(
    @Body() addGroupUserDto: AddGroupUserDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.addUserToGroup(
      addGroupUserDto.userId,
      addGroupUserDto.groupId,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'GroupUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  removeGroupMember(
    @Body() removeGroupUserDto: RemoveGroupUserDto,
    //@AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.removeUserFromGroup(
      removeGroupUserDto.userId,
      removeGroupUserDto.groupId,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, 'Group'))
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  deleteGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.groupService.deleteGroup(groupIdDto.groupId, workspace.id);
  }
}
