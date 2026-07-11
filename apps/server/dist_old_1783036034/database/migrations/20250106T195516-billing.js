"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('billing')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_uuid_v7()`))
        .addColumn('stripe_subscription_id', 'varchar', (col) => col.notNull())
        .addColumn('stripe_customer_id', 'varchar', (col) => col)
        .addColumn('status', 'varchar', (col) => col.notNull())
        .addColumn('quantity', 'int8', (col) => col)
        .addColumn('amount', 'int8', (col) => col)
        .addColumn('interval', 'varchar', (col) => col)
        .addColumn('currency', 'varchar', (col) => col)
        .addColumn('metadata', 'jsonb', (col) => col)
        .addColumn('stripe_price_id', 'varchar', (col) => col)
        .addColumn('stripe_item_id', 'varchar', (col) => col)
        .addColumn('stripe_product_id', 'varchar', (col) => col)
        .addColumn('period_start_at', 'timestamptz', (col) => col.notNull())
        .addColumn('period_end_at', 'timestamptz', (col) => col)
        .addColumn('cancel_at_period_end', 'boolean', (col) => col)
        .addColumn('cancel_at', 'timestamptz', (col) => col)
        .addColumn('canceled_at', 'timestamptz', (col) => col)
        .addColumn('ended_at', 'timestamptz', (col) => col)
        .addColumn('workspace_id', 'uuid', (col) => col.references('workspaces.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
        .addColumn('deleted_at', 'timestamptz', (col) => col)
        .execute();
    await db.schema
        .alterTable('billing')
        .addUniqueConstraint('billing_stripe_subscription_id_unique', [
        'stripe_subscription_id',
    ])
        .execute();
    await db.schema
        .alterTable('workspaces')
        .addColumn('stripe_customer_id', 'varchar', (col) => col)
        .addColumn('status', 'varchar', (col) => col)
        .addColumn('plan', 'varchar', (col) => col)
        .addColumn('billing_email', 'varchar', (col) => col)
        .addColumn('trial_end_at', 'timestamptz', (col) => col)
        .execute();
    await db.schema
        .alterTable('workspaces')
        .addUniqueConstraint('workspaces_stripe_customer_id_unique', [
        'stripe_customer_id',
    ])
        .execute();
}
async function down(db) {
    await db.schema.dropTable('billing').execute();
    await db.schema
        .alterTable('workspaces')
        .dropColumn('stripe_customer_id')
        .execute();
    await db.schema.alterTable('workspaces').dropColumn('status').execute();
    await db.schema.alterTable('workspaces').dropColumn('plan').execute();
    await db.schema
        .alterTable('workspaces')
        .dropColumn('billing_email')
        .execute();
    await db.schema.alterTable('workspaces').dropColumn('trial_end_at').execute();
}
//# sourceMappingURL=20250106T195516-billing.js.map