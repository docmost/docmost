import { OrderByDirection, OrderByModifiers, ReferenceExpression, SelectQueryBuilder, StringReference } from 'kysely';
type SortField<DB, TB extends keyof DB, O> = {
    expression: (StringReference<DB, TB> & keyof O & string) | (StringReference<DB, TB> & `${string}.${keyof O & string}`);
    direction: OrderByDirection;
    orderModifier?: OrderByModifiers;
    cursorExpression?: ReferenceExpression<DB, TB>;
    key?: keyof O & string;
} | {
    expression: ReferenceExpression<DB, TB>;
    direction: OrderByDirection;
    orderModifier?: OrderByModifiers;
    cursorExpression?: ReferenceExpression<DB, TB>;
    key: keyof O & string;
};
type ExtractSortFieldKey<DB, TB extends keyof DB, O, T extends SortField<DB, TB, O>> = T['key'] extends keyof O & string ? T['key'] : T['expression'] extends keyof O & string ? T['expression'] : T['expression'] extends `${string}.${infer K}` ? K extends keyof O & string ? K : never : never;
type Fields<DB, TB extends keyof DB, O> = ReadonlyArray<Readonly<SortField<DB, TB, O>>>;
type FieldNames<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = {
    [TIndex in keyof T]: ExtractSortFieldKey<DB, TB, O, T[TIndex]>;
};
type EncodeCursorValues<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = {
    [TIndex in keyof T]: [
        ExtractSortFieldKey<DB, TB, O, T[TIndex]>,
        O[ExtractSortFieldKey<DB, TB, O, T[TIndex]>]
    ];
};
export type CursorEncoder<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = (values: EncodeCursorValues<DB, TB, O, T>) => string;
type DecodedCursor<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = {
    [TField in ExtractSortFieldKey<DB, TB, O, T[number]>]: string;
};
export type CursorDecoder<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = (cursor: string, fields: FieldNames<DB, TB, O, T>) => DecodedCursor<DB, TB, O, T>;
type ParsedCursorValues<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = {
    [TField in ExtractSortFieldKey<DB, TB, O, T[number]>]: O[TField];
};
export type CursorParser<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = (cursor: DecodedCursor<DB, TB, O, T>) => ParsedCursorValues<DB, TB, O, T>;
type CursorPaginationResultRow<TRow, TCursorKey extends string | boolean | undefined> = TRow & {
    [K in TCursorKey extends undefined ? never : TCursorKey extends false ? never : TCursorKey extends true ? '$cursor' : TCursorKey]: string;
};
type CursorPaginationMeta = {
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
};
export type CursorPaginationResult<TRow, TCursorKey extends string | boolean | undefined = undefined> = {
    meta: CursorPaginationMeta;
    items: CursorPaginationResultRow<TRow, TCursorKey>[];
};
export declare function executeWithCursorPagination<DB, TB extends keyof DB, O, const TFields extends Fields<DB, TB, O>, TCursorKey extends string | boolean | undefined = undefined>(qb: SelectQueryBuilder<DB, TB, O>, opts: {
    perPage: number;
    cursor?: string;
    beforeCursor?: string;
    cursorPerRow?: TCursorKey;
    fields: TFields;
    encodeCursor?: CursorEncoder<DB, TB, O, TFields>;
    decodeCursor?: CursorDecoder<DB, TB, O, TFields>;
    parseCursor: CursorParser<DB, TB, O, TFields> | {
        parse: CursorParser<DB, TB, O, TFields>;
    };
}): Promise<CursorPaginationResult<O, TCursorKey>>;
export declare function defaultEncodeCursor<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>>(values: EncodeCursorValues<DB, TB, O, T>): string;
export declare function emptyCursorPaginationResult<T>(limit: number): CursorPaginationResult<T>;
export declare function defaultDecodeCursor<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>>(cursor: string, fields: FieldNames<DB, TB, O, T>): DecodedCursor<DB, TB, O, T>;
export {};
