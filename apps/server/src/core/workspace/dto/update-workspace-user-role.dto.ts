import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { UserRole } from '../../../common/helpers/types/permission.js';

export class UpdateWorkspaceUserRoleDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: string;
}
