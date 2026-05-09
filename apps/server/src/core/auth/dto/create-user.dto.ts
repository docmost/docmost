import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { NoUrls } from '../../../common/validators/no-urls.validator';

export class CreateUserDto {
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  @IsString()
  @NoUrls()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(70)
  @IsString()
  password: string;
}
