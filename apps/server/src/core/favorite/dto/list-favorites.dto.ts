import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListFavoritesDto {
  @IsOptional()
  @IsString()
  @IsIn(['page', 'space', 'template'])
  type?: 'page' | 'space' | 'template';

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
