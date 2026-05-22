import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { Transform, TransformFnParams } from 'class-transformer';
import { NoUrls } from '../../../common/validators/no-urls.validator';

export class CreateAdminUserDto extends CreateUserDto {
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @NoUrls()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  workspaceName: string;

  @IsOptional()
  @MinLength(4)
  @MaxLength(50)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  hostname?: string;
}
