import {IsAlphanumeric, IsOptional, IsString, MaxLength, MinLength} from 'class-validator';
import {Transform, TransformFnParams} from "class-transformer";

export class CreateWorkspaceDto {
  @MinLength(4)
  @MaxLength(64)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsOptional()
  @MinLength(4)
  @MaxLength(30)
  @IsAlphanumeric()
  hostname?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
