import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageMemberRole } from '@docmost/db/repos/page/page-permission-repo.service';

export class UpdatePagePermissionDto {
  @IsUUID()
  pageId: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsUUID()
  @IsOptional()
  groupId?: string;

  @IsEnum(PageMemberRole)
  role: string;

  @IsBoolean()
  cascade: boolean; // Apply to all child pages
}
