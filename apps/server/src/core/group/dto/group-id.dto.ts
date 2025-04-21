import { IsNotEmpty, IsUUID } from 'class-validator';

export class GroupIdDto {
  @IsNotEmpty()
  @IsUUID()
  groupId: string;
}
