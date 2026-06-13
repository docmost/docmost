import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class Oauth2CallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class Oauth2ConfigDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  clientSecret: string;
}
