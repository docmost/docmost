import { ArrayMaxSize, IsArray, IsEnum, IsUUID } from 'class-validator';
import { SpaceIdDto } from './space-id.dto';
import { SpaceRole } from '../../../common/helpers/types/permission';

export class AddSpaceMembersDto extends SpaceIdDto {
  // @IsOptional()
  // @IsUUID()
  // userId: string;

  @IsEnum(SpaceRole)
  role: string;

  @IsArray()
  @ArrayMaxSize(25, {
    message: 'userIds must an array with no more than 25 elements',
  })
  @IsUUID('all', { each: true })
  userIds: string[];

  @IsArray()
  @ArrayMaxSize(25, {
    message: 'userIds must an array with no more than 25 elements',
  })
  @IsUUID('all', { each: true })
  groupIds: string[];
}
