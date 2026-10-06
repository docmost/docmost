import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { LdapLoginDto } from './ldap-login.dto';

export class LdapSetupDto extends LdapLoginDto {
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  workspaceName?: string;
}