import { SpaceRole } from 'src/common/helpers/types/permission';
import { PageIdDto } from './page.dto';
import { ArrayMaxSize, IsArray, IsEnum, IsUUID } from 'class-validator';

export class AddPageMembersDto extends PageIdDto {
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
