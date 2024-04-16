import { IsOptional, IsUUID } from 'class-validator';
import { SpaceIdDto } from './page.dto';

export class SidebarPageDto extends SpaceIdDto {
  @IsOptional()
  @IsUUID()
  pageId: string;
}
