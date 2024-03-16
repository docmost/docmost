import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole } from '../../../helpers/types/permission';

export class InviteUserDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: string;
}

export class InvitationIdDto {
  @IsUUID()
  invitationId: string;
}

export class AcceptInviteDto extends InvitationIdDto {}

export class RevokeInviteDto extends InvitationIdDto {}
