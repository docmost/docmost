import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { SpaceIdDto } from './space-id.dto';
import { SpaceRole } from '../../../common/helpers/types/permission';

export class UpdateSpaceMemberRoleDto extends SpaceIdDto {
  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  groupId: string;

  @IsEnum(SpaceRole)
  role: string;
}
