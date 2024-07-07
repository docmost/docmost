import { IsBoolean, IsOptional, isString, IsString } from 'class-validator';

export class OidcConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  issuerUrl: string;

  @IsString()
  clientId: string;

  @IsString()
  buttonName: string;

  @IsBoolean()
  jitEnabled: boolean;
}
