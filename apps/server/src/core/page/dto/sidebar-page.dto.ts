import { IsOptional, IsString, IsUUID } from 'class-validator';
import { SpaceIdDto } from './page.dto';

export class SidebarPageDto {
  @IsOptional()
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  pageId: string;
}
