import { PaginationOptions } from './pagination-options';

export class PaginationMetaDto {
  readonly page: number;

  readonly limit: number;

  readonly total: number;

  readonly pageCount: number;

  readonly hasPreviousPage: boolean;

  readonly hasNextPage: boolean;

  constructor({ count, paginationOptions }: PageMetaDtoParameters) {
    this.page = paginationOptions.page;
    this.limit = paginationOptions.limit;
    this.total = count;
    this.pageCount = Math.ceil(this.total / this.limit);
    this.hasPreviousPage = this.page > 1;
    this.hasNextPage = this.page < this.pageCount;
  }
}

export interface PageMetaDtoParameters {
  count: number;
  paginationOptions: PaginationOptions;
}
