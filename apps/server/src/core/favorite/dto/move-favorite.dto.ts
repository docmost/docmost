import { IsString, MinLength, MaxLength } from 'class-validator';

export class MoveFavoriteDto {
  @IsString()
  pageId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(12)
  position: string;
}
