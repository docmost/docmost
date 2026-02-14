import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSsoProviderDto {
  @IsString()
  @IsIn(['oidc', 'saml', 'google', 'ldap'])
  type: string;

  @IsString()
  name: string;
}

export class UpdateSsoProviderDto {
  @IsUUID()
  providerId: string;

  @IsOptional()
  @IsString()
  name?: string;

  // OIDC fields
  @IsOptional()
  @IsString()
  oidcIssuer?: string;

  @IsOptional()
  @IsString()
  oidcClientId?: string;

  @IsOptional()
  @IsString()
  oidcClientSecret?: string;

  // SAML fields
  @IsOptional()
  @IsString()
  samlUrl?: string;

  @IsOptional()
  @IsString()
  samlCertificate?: string;

  // LDAP fields
  @IsOptional()
  @IsString()
  ldapUrl?: string;

  @IsOptional()
  @IsString()
  ldapBindDn?: string;

  @IsOptional()
  @IsString()
  ldapBindPassword?: string;

  @IsOptional()
  @IsString()
  ldapBaseDn?: string;

  @IsOptional()
  @IsString()
  ldapUserSearchFilter?: string;

  @IsOptional()
  ldapUserAttributes?: any;

  @IsOptional()
  @IsBoolean()
  ldapTlsEnabled?: boolean;

  @IsOptional()
  @IsString()
  ldapTlsCaCert?: string;

  // Common fields
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  groupSync?: boolean;
}

export class DeleteSsoProviderDto {
  @IsUUID()
  providerId: string;
}

export class GetSsoProviderDto {
  @IsUUID()
  providerId: string;
}
