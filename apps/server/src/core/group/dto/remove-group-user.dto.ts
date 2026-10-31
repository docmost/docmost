import { GroupIdDto } from './group-id.dto.js';
import { IsUUID } from 'class-validator';

export class RemoveGroupUserDto extends GroupIdDto {
  @IsUUID()
  userId: string;
}
