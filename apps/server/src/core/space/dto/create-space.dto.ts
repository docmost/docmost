import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSpaceDto {
  @MinLength(2)
  @MaxLength(64)
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @MinLength(2)
  @MaxLength(64)
  @IsString()
  slug: string;
}
