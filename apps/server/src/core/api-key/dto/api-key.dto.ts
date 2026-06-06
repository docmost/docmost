import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  apiKeyId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}

export class RevokeApiKeyDto {
  @IsString()
  @IsNotEmpty()
  apiKeyId: string;
}
