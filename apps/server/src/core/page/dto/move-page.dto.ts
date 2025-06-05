import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { isOperator } from 'kysely';

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

  @IsBoolean()
  @IsOptional()
  isMyPages?: boolean;

  @IsString()
  @IsOptional()
  personalSpaceId?: string;
}

export class MovePageToSpaceDto {
  @IsNotEmpty()
  @IsString()
  pageId: string;

  @IsNotEmpty()
  @IsString()
  spaceId: string;

  @IsOptional()
  @IsString()
  parentPageId?: string | null;
}
