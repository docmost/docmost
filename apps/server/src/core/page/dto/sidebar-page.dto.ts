import { IsOptional, IsString, IsIn } from 'class-validator';
import { SpaceIdDto } from './page.dto';

export class SidebarPageDto extends SpaceIdDto {
  @IsOptional()
  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsIn(['position', 'alphabetical', 'recent'])
  sortBy?: string;
}
