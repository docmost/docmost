import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class FavoriteIdsDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['page', 'space', 'template'])
  type: 'page' | 'space' | 'template';

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
