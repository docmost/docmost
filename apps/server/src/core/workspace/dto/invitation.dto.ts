import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { WorkspaceUserRole } from '../entities/workspace-user.entity';

export class InviteUserDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(WorkspaceUserRole)
  role: string;
}

export class InvitationIdDto {
  @IsUUID()
  invitationId: string;
}

export class AcceptInviteDto extends InvitationIdDto {}

export class RevokeInviteDto extends InvitationIdDto {}
