import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @ValidateIf((o) => o.totpToken !== undefined && o.totpToken !== null && o.totpToken !== '')
  @IsString()
  @Length(6, 8)
  totpToken?: string;
}
