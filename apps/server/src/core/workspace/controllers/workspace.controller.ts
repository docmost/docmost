import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import { UpdateWorkspaceUserRoleDto } from '../dto/update-workspace-user-role.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../decorators/auth-workspace.decorator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { WorkspaceInvitationService } from '../services/workspace-invitation.service';
import { Public } from '../../../decorators/public.decorator';
import {
  AcceptInviteDto,
  InvitationIdDto,
  InviteUserDto,
  RevokeInviteDto,
} from '../dto/invitation.dto';
import { Action } from '../../casl/ability.action';
import { CheckPolicies } from '../../casl/decorators/policies.decorator';
import { AppAbility } from '../../casl/abilities/casl-ability.factory';
import { PoliciesGuard } from '../../casl/guards/policies.guard';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceInvitationService: WorkspaceInvitationService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/public')
  async getWorkspacePublicInfo(@Req() req) {
    return this.workspaceService.getWorkspacePublicData(req.raw.workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getWorkspace(@AuthWorkspace() workspace: Workspace) {
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
    ability.can(Action.Read, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('members')
  async getWorkspaceMembers(
    @Body()
    pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceService.getWorkspaceUsers(workspace.id, pagination);
  }

  @UseGuards(PoliciesGuard)
  // @CheckPolicies((ability: AppAbility) =>
  //   ability.can(Action.Manage, 'WorkspaceUser'),
  // )
  @HttpCode(HttpStatus.OK)
  @Post('members/deactivate')
  async deactivateWorkspaceMember() {
    return this.workspaceService.deactivateUser();
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
    return this.workspaceService.updateWorkspaceUserRole(
      authUser,
      workspaceUserRoleDto,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Read, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('invites')
  async getInvitations(
    @AuthWorkspace() workspace: Workspace,
    @Body()
    pagination: PaginationOptions,
  ) {
    return this.workspaceInvitationService.getInvitations(
      workspace.id,
      pagination,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('invites/info')
  async getInvitationById(@Body() dto: InvitationIdDto, @Req() req: any) {
    return this.workspaceInvitationService.getInvitationById(
      dto.invitationId,
      req.raw.workspaceId,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('invites/create')
  async inviteUser(
    @Body() inviteUserDto: InviteUserDto,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() authUser: User,
  ) {
    return this.workspaceInvitationService.createInvitation(
      inviteUserDto,
      workspace.id,
      authUser,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('invites/resend')
  async resendInvite(
    @Body() revokeInviteDto: RevokeInviteDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceInvitationService.resendInvitation(
      revokeInviteDto.invitationId,
      workspace.id,
    );
  }

  @UseGuards(PoliciesGuard)
  @CheckPolicies((ability: AppAbility) =>
    ability.can(Action.Manage, 'WorkspaceUser'),
  )
  @HttpCode(HttpStatus.OK)
  @Post('invites/revoke')
  async revokeInvite(
    @Body() revokeInviteDto: RevokeInviteDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.workspaceInvitationService.revokeInvitation(
      revokeInviteDto.invitationId,
      workspace.id,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('invites/accept')
  async acceptInvite(
    @Body() acceptInviteDto: AcceptInviteDto,
    @Req() req: any,
  ) {
    return this.workspaceInvitationService.acceptInvitation(
      acceptInviteDto,
      req.raw.workspaceId,
    );
  }
}
