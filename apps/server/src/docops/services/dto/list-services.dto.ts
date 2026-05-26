import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, TransformFnParams, Type } from 'class-transformer';

export class ListServicesDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  search?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsIn(['active', 'deprecated', 'retired'])
  lifecycleState?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
