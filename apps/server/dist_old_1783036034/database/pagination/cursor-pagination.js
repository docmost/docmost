"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWithCursorPagination = executeWithCursorPagination;
exports.defaultEncodeCursor = defaultEncodeCursor;
exports.emptyCursorPaginationResult = emptyCursorPaginationResult;
exports.defaultDecodeCursor = defaultDecodeCursor;
async function executeWithCursorPagination(qb, opts) {
    const encodeCursor = opts.encodeCursor ?? defaultEncodeCursor;
    const decodeCursor = opts.decodeCursor ?? defaultDecodeCursor;
    const parseCursor = typeof opts.parseCursor === 'function'
        ? opts.parseCursor
        : opts.parseCursor.parse;
    const fields = opts.fields.map((field) => {
        let key = field.key;
        if (!key && typeof field.expression === 'string') {
            const expressionParts = field.expression.split('.');
            key = (expressionParts[1] ?? expressionParts[0]);
        }
        if (!key)
            throw new Error('missing key');
        return { ...field, key };
    });
    function generateCursor(row) {
        const cursorFieldValues = fields.map(({ key }) => [
            key,
            row[key],
        ]);
        return encodeCursor(cursorFieldValues);
    }
    const fieldNames = fields.map((field) => field.key);
    function applyCursor(qb, encoded, defaultDirection) {
        const decoded = decodeCursor(encoded, fieldNames);
        const cursor = parseCursor(decoded);
        return qb.where(({ and, or, eb }) => {
            let expression;
            for (let i = fields.length - 1; i >= 0; --i) {
                const field = fields[i];
                const comparison = field.direction === defaultDirection ? '>' : '<';
                const value = cursor[field.key];
                const compareExpr = field.cursorExpression ?? field.expression;
                const conditions = [eb(compareExpr, comparison, value)];
                if (expression) {
                    conditions.push(and([eb(compareExpr, '=', value), expression]));
                }
                expression = or(conditions);
            }
            if (!expression) {
                throw new Error('Error building cursor expression');
            }
            return expression;
        });
    }
    if (opts.cursor)
        qb = applyCursor(qb, opts.cursor, 'asc');
    if (opts.beforeCursor)
        qb = applyCursor(qb, opts.beforeCursor, 'desc');
    const reversed = !!opts.beforeCursor && !opts.cursor;
    for (const { expression, direction, orderModifier } of fields) {
        qb = qb.orderBy(expression, orderModifier ??
            (reversed ? (direction === 'asc' ? 'desc' : 'asc') : direction));
    }
    const rows = await qb.limit(opts.perPage + 1).execute();
    const hasNextPage = rows.length > opts.perPage;
    if (rows.length > opts.perPage)
        rows.pop();
    if (reversed)
        rows.reverse();
    const startRow = rows[0];
    const endRow = rows[rows.length - 1];
    const hasPrevPage = !!opts.cursor;
    const prevCursor = hasPrevPage && startRow ? generateCursor(startRow) : null;
    const nextCursor = hasNextPage && endRow ? generateCursor(endRow) : null;
    return {
        items: rows.map((row) => {
            if (opts.cursorPerRow) {
                const cursorKey = typeof opts.cursorPerRow === 'string' ? opts.cursorPerRow : '$cursor';
                row[cursorKey] = generateCursor(row);
            }
            return row;
        }),
        meta: {
            limit: opts.perPage,
            hasNextPage,
            hasPrevPage,
            nextCursor,
            prevCursor,
        },
    };
}
function defaultEncodeCursor(values) {
    const cursor = new URLSearchParams();
    for (const [key, value] of values) {
        switch (typeof value) {
            case 'string':
                cursor.set(key, value);
                break;
            case 'number':
            case 'bigint':
                cursor.set(key, value.toString(10));
                break;
            case 'object': {
                if (value instanceof Date) {
                    cursor.set(key, value.toISOString());
                    break;
                }
            }
            default:
                throw new Error(`Unable to encode '${key.toString()}'`);
        }
    }
    return Buffer.from(cursor.toString(), 'utf8').toString('base64url');
}
function emptyCursorPaginationResult(limit) {
    return {
        items: [],
        meta: {
            limit,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
        },
    };
}
function defaultDecodeCursor(cursor, fields) {
    let parsed;
    try {
        parsed = [
            ...new URLSearchParams(Buffer.from(cursor, 'base64url').toString('utf8')).entries(),
        ];
    }
    catch {
        throw new Error('Unparsable cursor');
    }
    if (parsed.length !== fields.length) {
        throw new Error('Unexpected number of fields');
    }
    for (let i = 0; i < fields.length; i++) {
        const field = parsed[i];
        const expectedName = fields[i];
        if (!field) {
            throw new Error('Unable to find field');
        }
        if (field[0] !== expectedName) {
            throw new Error('Unexpected field name');
        }
    }
    return Object.fromEntries(parsed);
}
//# sourceMappingURL=cursor-pagination.js.map