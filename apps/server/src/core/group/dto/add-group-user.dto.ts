import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { GroupIdDto } from './group-id.dto';

export class AddGroupUserDto extends GroupIdDto {
  // @IsOptional()
  // @IsUUID()
  // userId: string;

  @IsArray()
  @ArrayMaxSize(50, {
    message: 'userIds must an array with no more than 50 elements',
  })
  @ArrayMinSize(1)
  @IsUUID(4, { each: true })
  userIds: string[];
}
