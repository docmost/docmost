import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CreateTemplateDto {
  @MinLength(1)
  @MaxLength(500)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  content?: any;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
