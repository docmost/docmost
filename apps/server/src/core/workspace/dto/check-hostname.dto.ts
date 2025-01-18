import { IsAlphanumeric, MaxLength, MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CheckHostnameDto {
  @MinLength(1)
  @IsAlphanumeric()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  hostname: string;
}
