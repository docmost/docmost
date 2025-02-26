import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import {Transform, TransformFnParams} from "class-transformer";

export class CreateAdminUserDto extends CreateUserDto {
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  workspaceName: string;
}
