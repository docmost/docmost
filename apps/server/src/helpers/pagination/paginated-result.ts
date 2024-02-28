import { IsArray } from 'class-validator';
import { PaginationMetaDto } from './pagination-meta-dto';

export class PaginatedResult<T> {
  @IsArray()
  readonly items: T[];

  readonly pagination: PaginationMetaDto;

  constructor(items: T[], pagination: PaginationMetaDto) {
    this.items = items;
    this.pagination = pagination;
  }
}
