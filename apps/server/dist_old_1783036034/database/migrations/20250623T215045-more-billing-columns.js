"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('billing')
        .addColumn('billing_scheme', 'varchar', (col) => col)
        .addColumn('tiered_up_to', 'varchar', (col) => col)
        .addColumn('tiered_flat_amount', 'int8', (col) => col)
        .addColumn('tiered_unit_amount', 'int8', (col) => col)
        .addColumn('plan_name', 'varchar', (col) => col)
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('billing')
        .dropColumn('billing_scheme')
        .dropColumn('tiered_up_to')
        .dropColumn('tiered_flat_amount')
        .dropColumn('tiered_unit_amount')
        .dropColumn('plan_name')
        .execute();
}
//# sourceMappingURL=20250623T215045-more-billing-columns.js.map