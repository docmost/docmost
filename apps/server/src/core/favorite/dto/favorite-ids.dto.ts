import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class FavoriteIdsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['page', 'space', 'template'])
  type: 'page' | 'space' | 'template';
}
