import { IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

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
  @IsNumber()
  offset = 0;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}
