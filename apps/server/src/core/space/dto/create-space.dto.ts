import {
  IsAlphanumeric,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSpaceDto {
  @MinLength(2)
  @MaxLength(50)
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @MinLength(2)
  @MaxLength(50)
  @IsAlphanumeric()
  slug: string;
}
