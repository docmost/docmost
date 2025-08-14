import { IsEnum, IsUUID } from 'class-validator';
import { PageIdDto } from './page.dto';
import { PageMemberRole } from '@docmost/db/repos/page/page-permission-repo.service';

export class UpdatePageMemberRoleDto extends PageIdDto {
  @IsUUID()
  memberId: string;

  @IsEnum(PageMemberRole)
  role: string;
}
