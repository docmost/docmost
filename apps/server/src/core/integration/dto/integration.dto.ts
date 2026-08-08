import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class InstallIntegrationDto {
  @IsNotEmpty()
  @IsString()
  type: string;
}

export class UninstallIntegrationDto {
  @IsNotEmpty()
  @IsString()
  integrationId: string;
}

export class UpdateIntegrationDto {
  @IsNotEmpty()
  @IsString()
  integrationId: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class IntegrationIdDto {
  @IsNotEmpty()
  @IsString()
  integrationId: string;
}

export class UnfurlDto {
  @IsNotEmpty()
  @IsString()
  url: string;
}

export class OAuthAuthorizeDto {
  @IsNotEmpty()
  @IsString()
  integrationId: string;

  // In-app path to land on after OAuth; single leading slash keeps the
  // redirect on the workspace origin.
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/(?!\/)[^\s\\]*$/)
  returnPath?: string;
}

export class OAuthDisconnectDto {
  @IsNotEmpty()
  @IsString()
  integrationId: string;
}

export class OAuthInstallDto {
  @IsNotEmpty()
  @IsString()
  type: string;
}
