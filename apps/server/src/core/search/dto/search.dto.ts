import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchDTO {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}
