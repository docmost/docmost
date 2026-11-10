import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export class ListSpacesDto extends PaginationOptions {
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
