import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  UNSPLASH_MAX_PAGE,
  UNSPLASH_MAX_QUERY_LENGTH,
} from '../unsplash.constants';

export class ListUnsplashPhotosDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(UNSPLASH_MAX_QUERY_LENGTH)
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(UNSPLASH_MAX_PAGE)
  page?: number;
}
