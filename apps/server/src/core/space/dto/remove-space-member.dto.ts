import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { SpaceIdDto } from './space-id.dto';

export class RemoveSpaceMemberDto extends SpaceIdDto {
  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  groupId: string;
}
