"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWithPagination = executeWithPagination;
const kysely_1 = require("kysely");
async function executeWithPagination(qb, opts) {
    if (opts.page < 1) {
        opts.page = 1;
    }
    qb = qb.limit(opts.perPage + 1).offset((opts.page - 1) * opts.perPage);
    const deferredJoinPrimaryKey = opts.experimental_deferredJoinPrimaryKey;
    if (deferredJoinPrimaryKey) {
        const primaryKeys = await qb
            .clearSelect()
            .select((eb) => eb.ref(deferredJoinPrimaryKey).as('primaryKey'))
            .execute()
            .then((rows) => rows.map((row) => row.primaryKey));
        qb = qb
            .where((eb) => primaryKeys.length > 0
            ? eb(deferredJoinPrimaryKey, 'in', primaryKeys)
            : eb((0, kysely_1.sql) `1`, '=', 0))
            .clearOffset()
            .clearLimit();
    }
    const rows = opts.hasEmptyIds ? [] : await qb.execute();
    const hasNextPage = rows.length > 0 ? rows.length > opts.perPage : false;
    const hasPrevPage = rows.length > 0 ? opts.page > 1 : false;
    if (rows.length > opts.perPage) {
        rows.pop();
    }
    return {
        items: rows,
        meta: {
            limit: opts.perPage,
            page: opts.page,
            hasNextPage,
            hasPrevPage,
        },
    };
}
//# sourceMappingURL=pagination.js.map