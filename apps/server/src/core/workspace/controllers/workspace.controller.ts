import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { DeleteWorkspaceDto } from '../dto/delete-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../decorators/auth-workspace.decorator';
import { PaginationOptions } from '../../../kysely/pagination/pagination-options';
import { WorkspaceInvitationService } from '../services/workspace-invitation.service';
import { Public } from '../../../decorators/public.decorator';
import {
  AcceptInviteDto,
  InviteUserDto,
  RevokeInviteDto,
} from '../dto/invitation.dto';
import { Action } from '../../casl/ability.action';
import { CheckPolicies } from '../../casl/decorators/policies.decorator';
import { AppAbility } from '../../casl/abilities/casl-ability.factory';
import { PoliciesGuard } from '../../casl/guards/policies.guard';
import { WorkspaceUserService } from '../services/workspace-user.service';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getWorkspace(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceService.getWorkspaceInfo(workspace.id);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'Workspace'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateWorkspace(
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceService.update(workspace.id, updateWorkspaceDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'Workspace'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteWorkspace(@Body() deleteWorkspaceDto: DeleteWorkspaceDto) {
    // return this.workspaceService.delete(deleteWorkspaceDto);
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Read, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getWorkspaceMembers(
    @Body()
    pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.getWorkspaceUsers(
      workspace.id,
      pagination,
    );
  }

  @UseGuards(PoliciesGuard)
  // @CheckPolicies((ability: AppAbility) =>
  //   ability.can(Action.Manage, 'WorkspaceUser'),
  // )
  @HttpCode(HttpStatus.OK)
  @Post('members/deactivate')
  async deactivateWorkspaceMember() {
    return this.workspaceUserService.deactivateUser();
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('members/role')
  async updateWorkspaceMemberRole(
    @Body() workspaceUserRoleDto: UpdateWorkspaceUserRoleDto,
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceUserService.updateWorkspaceUserRole(
      authUser,
      workspaceUserRoleDto,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'WorkspaceInvitation'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('invite')
  async inviteUser(
    @Body() inviteUserDto: InviteUserDto,
    @AuthUser() authUser: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    /* return this.workspaceInvitationService.createInvitation(
      authUser,
      workspace.id,
      inviteUserDto,
    );*/
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('invite/accept')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    // return this.workspaceInvitationService.acceptInvitation(
    //    acceptInviteDto.invitationId,
    //);
  }

  // TODO: authorize permission with guards
  @HttpCode(HttpStatus.OK)
  @Post('invite/revoke')
  async revokeInvite(@Body() revokeInviteDto: RevokeInviteDto) {
    // return this.workspaceInvitationService.revokeInvitation(
    // revokeInviteDto.invitationId,
    // );
  }
}
