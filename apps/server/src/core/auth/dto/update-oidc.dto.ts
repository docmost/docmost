import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateOidcConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled: boolean | undefined;

  @IsString()
  @IsOptional()
  issuerUrl: string | undefined;

  @IsString()
  @IsOptional()
  clientId: string | undefined;

  @IsString()
  @IsOptional()
  clientSecret: string | undefined;

  @IsString()
  @IsOptional()
  buttonName: string | undefined;

  @IsBoolean()
  @IsOptional()
  jitEnabled: boolean | undefined;
}
