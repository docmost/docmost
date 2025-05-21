import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class MovePageDto {
  @IsString()
  pageId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(12)
  position: string;

  @IsOptional()
  @IsString()
  parentPageId?: string | null;
}

export class MovePageToSpaceDto {
  @IsNotEmpty()
  @IsString()
  pageId: string;

  @IsNotEmpty()
  @IsString()
  spaceId: string;
}
