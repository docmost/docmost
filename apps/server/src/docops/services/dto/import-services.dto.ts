import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class ImportServiceItemDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'code must contain only lowercase letters, numbers, hyphens and underscores',
  })
  @Transform(({ value }: TransformFnParams) => value?.trim().toLowerCase())
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(['active', 'deprecated', 'retired'])
  lifecycleState?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ImportServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportServiceItemDto)
  services: ImportServiceItemDto[];
}
