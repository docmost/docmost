import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SidebarPageDto {
  @IsOptional()
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  pageId: string;
}
