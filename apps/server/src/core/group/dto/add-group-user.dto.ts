import { IsNotEmpty, IsUUID } from 'class-validator';
import { GroupIdDto } from './group-id.dto';

export class AddGroupUserDto extends GroupIdDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
