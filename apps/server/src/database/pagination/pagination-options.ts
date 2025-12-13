import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PaginationOptions {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  query: string;

  @IsOptional()
  @IsBoolean()
  adminView: boolean;
}
