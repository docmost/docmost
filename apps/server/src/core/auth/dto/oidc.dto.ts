import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateOidcProviderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
  })
  oidcIssuer: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  oidcClientId: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
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
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
  })
  oidcIssuer?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  oidcClientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
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
