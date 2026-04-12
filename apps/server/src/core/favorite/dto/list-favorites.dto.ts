import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListFavoritesDto {
  @IsOptional()
  @IsString()
  @IsIn(['page', 'space', 'template'])
  type?: 'page' | 'space' | 'template';
}
