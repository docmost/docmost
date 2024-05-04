import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @MinLength(8)
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  @MinLength(8)
  @IsString()
  newPassword: string;
}
