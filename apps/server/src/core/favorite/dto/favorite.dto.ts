import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddFavoriteDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['page', 'space', 'template'])
  type: 'page' | 'space' | 'template';

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class RemoveFavoriteDto extends AddFavoriteDto {}
