import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { SpaceRole } from 'src/common/helpers/types/permission';
import { PageIdDto } from './page.dto';

export class UpdatePageMemberRoleDto extends PageIdDto {
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
