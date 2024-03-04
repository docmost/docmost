import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceInvitationRepository } from '../repositories/workspace-invitation.repository';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { User } from '../../user/entities/user.entity';
import { WorkspaceService } from './workspace.service';
import { WorkspaceUserService } from './workspace-user.service';
import { WorkspaceUserRole } from '../entities/workspace-user.entity';
import { UserService } from '../../user/user.service';
import { InviteUserDto } from '../dto/invitation.dto';

@Injectable()
export class WorkspaceInvitationService {
  constructor(
    private workspaceInvitationRepository: WorkspaceInvitationRepository,
    private workspaceService: WorkspaceService,
    private workspaceUserService: WorkspaceUserService,
    private userService: UserService,
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
    const authUserMembership =
      await this.workspaceUserService.findWorkspaceUser(
        authUser.id,
        workspaceId,
      );

    if (!authUserMembership) {
      throw new BadRequestException('Inviting user must be a workspace member');
    }

    if (authUserMembership.role != WorkspaceUserRole.OWNER) {
      throw new BadRequestException(
        'Only workspace owners can invite new members',
      );
    }

    const invitedUser = await this.userService.findByEmail(inviteUserDto.email);

    // check if invited user is already a workspace member
    if (invitedUser) {
      const invitedUserMembership =
        await this.workspaceUserService.findWorkspaceUser(
          invitedUser.id,
          workspaceId,
        );

      if (invitedUserMembership) {
        throw new BadRequestException(
          'This user already a member of this workspace',
        );
      }
    }

    // check if user was already invited
    const existingInvitation = await this.findInvitedUserByEmail(
      inviteUserDto.email,
      workspaceId,
    );

    if (existingInvitation) {
      throw new BadRequestException('This user has already been invited');
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

    // check if user is in the system already
    const invitedUser = await this.userService.findByEmail(invitation.email);

    if (invitedUser) {
      // fetch the workspace
      // add the user to the workspace
    }
    return invitation;
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
