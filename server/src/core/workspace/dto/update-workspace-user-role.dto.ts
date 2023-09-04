import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateWorkspaceUserRoleDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  role: string;
}
