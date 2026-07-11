"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTx = executeTx;
exports.dbOrTx = dbOrTx;
async function executeTx(db, callback, existingTrx) {
    if (existingTrx) {
        return await callback(existingTrx);
    }
    else {
        return await db.transaction().execute((trx) => callback(trx));
    }
}
function dbOrTx(db, existingTrx) {
    if (existingTrx) {
        return existingTrx;
    }
    else {
        return db;
    }
}
//# sourceMappingURL=utils.js.map