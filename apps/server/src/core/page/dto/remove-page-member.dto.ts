import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { PageIdDto } from './page.dto';

export class RemovePageMemberDto extends PageIdDto {
  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsNotEmpty()
  @IsUUID()
  groupId: string;
}
