import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class RegisterDto {
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  email: string;
}
