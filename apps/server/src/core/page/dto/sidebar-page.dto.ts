import { IsOptional, IsString } from 'class-validator';
import { SpaceIdDto } from './page.dto';

export class SidebarPageDto extends SpaceIdDto {
  @IsOptional()
  @IsString()
  pageId: string;
}
