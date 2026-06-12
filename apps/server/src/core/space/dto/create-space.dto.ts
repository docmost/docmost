import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {Transform, TransformFnParams} from "class-transformer";

export class CreateSpaceDto {
  @MinLength(2)
  @MaxLength(100)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'slug can only contain letters, numbers, and hyphens',
  })
  slug: string;
}
