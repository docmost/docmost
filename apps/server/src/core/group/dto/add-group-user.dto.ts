import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { GroupIdDto } from './group-id.dto';

export class AddGroupUserDto extends GroupIdDto {
  @IsArray()
  @ArrayMaxSize(50, {
    message: 'you cannot add more than 50 users at a time',
  })
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds: string[];
}
