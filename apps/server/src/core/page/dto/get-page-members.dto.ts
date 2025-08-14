import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { PageIdDto } from './page.dto';
import { Type } from 'class-transformer';

export class GetPageMembersDto extends PageIdDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  query?: string;
}
