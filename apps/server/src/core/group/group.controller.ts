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
import { JwtGuard } from '../auth/guards/jwt.guard';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { CurrentWorkspace } from '../../decorators/current-workspace.decorator';
import { User } from '../user/entities/user.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { GroupUserService } from './services/group-user.service';
import { GroupIdDto } from './dto/group-id.dto';
import { PaginationOptions } from '../../helpers/pagination/pagination-options';
import { AddGroupUserDto } from './dto/add-group-user.dto';
import { RemoveGroupUserDto } from './dto/remove-group-user.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Action } from '../casl/ability.action';
import { Group } from './entities/group.entity';
import { GroupUser } from './entities/group-user.entity';
import { PoliciesGuard } from '../casl/guards/policies.guard';
import { CheckPolicies } from '../casl/decorators/policies.decorator';
import { AppAbility } from '../casl/abilities/casl-ability.factory';

@UseGuards(JwtGuard)
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
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupService.getGroupsInWorkspace(workspace.id, pagination);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Read, Group))
  @HttpCode(HttpStatus.OK)
  @Post('/details')
  getGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupService.getGroup(groupIdDto.groupId, workspace.id);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, Group))
  @HttpCode(HttpStatus.OK)
  @Post('create')
  createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupService.createGroup(user, workspace.id, createGroupDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, Group))
  @HttpCode(HttpStatus.OK)
  @Post('update')
  updateGroup(
    @Body() updateGroupDto: UpdateGroupDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupService.updateGroup(workspace.id, updateGroupDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Read, GroupUser))
  @HttpCode(HttpStatus.OK)
  @Post('members')
  getGroupMembers(
    @Body() groupIdDto: GroupIdDto,
    @Body() pagination: PaginationOptions,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.getGroupUsers(
      groupIdDto.groupId,
      workspace.id,
      pagination,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, GroupUser))
  @HttpCode(HttpStatus.OK)
  @Post('members/add')
  addGroupMember(
    @Body() addGroupUserDto: AddGroupUserDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.addUserToGroup(
      addGroupUserDto.userId,
      addGroupUserDto.groupId,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, GroupUser))
  @HttpCode(HttpStatus.OK)
  @Post('members/remove')
  removeGroupMember(
    @Body() removeGroupUserDto: RemoveGroupUserDto,
    //@AuthUser() user: User,
    //@CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupUserService.removeUserFromGroup(
      removeGroupUserDto.userId,
      removeGroupUserDto.groupId,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.Manage, Group))
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  deleteGroup(
    @Body() groupIdDto: GroupIdDto,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    return this.groupService.deleteGroup(groupIdDto.groupId, workspace.id);
  }
}
