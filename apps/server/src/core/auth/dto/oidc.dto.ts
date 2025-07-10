import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsUrl } from 'class-validator';

export class CreateOidcProviderDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsUrl()
  oidcIssuer: string;

  @IsNotEmpty()
  @IsString()
  oidcClientId: string;

  @IsNotEmpty()
  @IsString()
  oidcClientSecret: string;

  @IsOptional()
  @IsBoolean()
  allowSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  enforceSso?: boolean;
}

export class UpdateOidcProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  oidcIssuer?: string;

  @IsOptional()
  @IsString()
  oidcClientId?: string;

  @IsOptional()
  @IsString()
  oidcClientSecret?: string;

  @IsOptional()
  @IsBoolean()
  allowSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  enforceSso?: boolean;
}
