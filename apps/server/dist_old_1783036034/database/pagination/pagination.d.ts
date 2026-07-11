import { SelectQueryBuilder, StringReference } from 'kysely';
export type PaginationMeta = {
    limit: number;
    page: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
};
export type PaginationResult<T> = {
    items: T[];
    meta: PaginationMeta;
};
export declare function executeWithPagination<O, DB, TB extends keyof DB>(qb: SelectQueryBuilder<DB, TB, O>, opts: {
    perPage: number;
    page: number;
    experimental_deferredJoinPrimaryKey?: StringReference<DB, TB>;
    hasEmptyIds?: boolean;
}): Promise<PaginationResult<O>>;
