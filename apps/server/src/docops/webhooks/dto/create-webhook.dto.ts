import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsUrl()
  url: string;

  @IsString()
  @MinLength(16)
  secret: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^[a-z]+\.[a-z_]+$/, { each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
