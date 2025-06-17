import { MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CheckHostnameDto {
  @MinLength(4)
  @Transform(({ value }: TransformFnParams) => value?.trim())
  hostname: string;
}
