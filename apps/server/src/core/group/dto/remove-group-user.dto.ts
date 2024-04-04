import { GroupIdDto } from './group-id.dto';
import { IsUUID } from 'class-validator';

export class RemoveGroupUserDto extends GroupIdDto {
  @IsUUID()
  userId: string;
}
