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

export class ChangeWorkspaceMemberPasswordDto {
  @IsNotEmpty()
  @MinLength(8)
  @IsString()
  actorPassword: string;

  @IsNotEmpty()
  @MinLength(8)
  @IsString()
  newPassword: string;

  @IsNotEmpty()
  @IsString()
  userId: string;
}
