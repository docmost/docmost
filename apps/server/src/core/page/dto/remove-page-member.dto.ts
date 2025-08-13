import { IsUUID } from 'class-validator';
import { PageIdDto } from './page.dto';

export class RemovePageMemberDto extends PageIdDto {
  @IsUUID()
  memberId: string;
}