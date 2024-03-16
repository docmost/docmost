import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { User } from '../../user/entities/user.entity';
import { WorkspaceService } from './workspace.service';
import { UserService } from '../../user/user.service';
import { InviteUserDto } from '../dto/invitation.dto';
import { WorkspaceUserService } from './workspace-user.service';
import { UserRole } from '../../../helpers/types/permission';
import { UserRepository } from '../../user/repositories/user.repository';

@Injectable()
export class WorkspaceInvitationService {
  constructor(
    private workspaceInvitationRepository: WorkspaceInvitationRepository,
    private workspaceService: WorkspaceService,
    private workspaceUserService: WorkspaceUserService,
    private userService: UserService,
    private userRepository: UserRepository,
  ) {}

  async findInvitedUserByEmail(
    email,
    workspaceId,
  ): Promise<WorkspaceInvitation> {
    return this.workspaceInvitationRepository.findOneBy({
      email: email,
      workspaceId: workspaceId,
    });
  }

  async createInvitation(
    authUser: User,
    workspaceId: string,
    inviteUserDto: InviteUserDto,
  ): Promise<WorkspaceInvitation> {
    // check if invited user is already a workspace member
    const invitedUser =
      await this.workspaceUserService.findWorkspaceUserByEmail(
        inviteUserDto.email,
        workspaceId,
      );

    if (invitedUser) {
      throw new BadRequestException(
        'User is already a member of this workspace',
      );
    }

    // check if user was already invited
    const existingInvitation = await this.findInvitedUserByEmail(
      inviteUserDto.email,
      workspaceId,
    );

    if (existingInvitation) {
      throw new BadRequestException('User has already been invited');
    }

    const invitation = new WorkspaceInvitation();
    invitation.workspaceId = workspaceId;
    invitation.email = inviteUserDto.email;
    invitation.role = inviteUserDto.role;
    invitation.invitedById = authUser.id;

    // TODO: send invitation email

    return await this.workspaceInvitationRepository.save(invitation);
  }

  async acceptInvitation(invitationId: string) {
    const invitation = await this.workspaceInvitationRepository.findOneBy({
      id: invitationId,
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation code');
    }

    // TODO: to be completed

    // check if user is already a member
    const invitedUser =
      await this.workspaceUserService.findWorkspaceUserByEmail(
        invitation.email,
        invitation.workspaceId,
      );

    if (invitedUser) {
      throw new BadRequestException(
        'User is already a member of this workspace',
      );
    }
    // add create account for user
    // add the user to the workspace

    return null;
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const invitation = await this.workspaceInvitationRepository.findOneBy({
      id: invitationId,
    });

    if (!invitation) {
      throw new BadRequestException('Invitation not found');
    }

    await this.workspaceInvitationRepository.delete(invitationId);
  }
}
