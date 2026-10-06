import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LdapLoginDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  username: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1024)
  password: string;
}