import {
  IsString,
  IsUUID,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class MovePageDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(12)
  position: string;

  @IsOptional()
  @IsString()
  parentPageId?: string | null;
}
