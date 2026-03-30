import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOidcProviderDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(120)
  slug: string;

  @IsString()
  oidcIssuer: string;

  @IsString()
  oidcClientId: string;

  @IsString()
  oidcClientSecret: string;

  @IsOptional()
  @IsArray()
  domains?: string[];

  @IsOptional()
  @IsBoolean()
  autoJoinByEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateUsers?: boolean;
}
