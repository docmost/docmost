import { MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CheckHostnameDto {
  @MinLength(1)
  @Transform(({ value }: TransformFnParams) => value?.trim())
  hostname: string;
}
