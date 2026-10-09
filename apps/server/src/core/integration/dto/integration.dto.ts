import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class UninstallIntegrationDto {
  @IsUUID()
  integrationId: string;
}

export class UnfurlDto {
  // Caps the input the unfurl regexes run on
  @IsNotEmpty()
  @IsString()
  @MaxLength(8192)
  @Matches(/^[^\s\x00-\x1f\x7f]+$/)
  url: string;
}

export class OAuthAuthorizeDto {
  @IsUUID()
  integrationId: string;

  // A single leading slash, so "//host" can't redirect off the workspace origin
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Matches(/^\/(?!\/)[^\s\\\x00-\x1f\x7f]*$/)
  returnPath?: string;
}

export class OAuthDisconnectDto {
  @IsUUID()
  integrationId: string;
}

export class OAuthInstallDto {
  @IsNotEmpty()
  @IsString()
  type: string;
}
