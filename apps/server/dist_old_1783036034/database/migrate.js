"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs_1 = require("fs");
const kysely_1 = require("kysely");
const kysely_migration_cli_1 = require("kysely-migration-cli");
const dotenv = require("dotenv");
const helpers_1 = require("../common/helpers");
const kysely_postgres_js_1 = require("kysely-postgres-js");
const postgres_1 = require("postgres");
dotenv.config({ path: helpers_1.envPath });
const migrationFolder = path.join(__dirname, './migrations');
const db = new kysely_1.Kysely({
    dialect: new kysely_postgres_js_1.PostgresJSDialect({
        postgres: (0, postgres_1.default)((0, helpers_1.normalizePostgresUrl)(process.env.DATABASE_URL)),
    }),
});
const migrator = new kysely_1.Migrator({
    db,
    provider: new kysely_1.FileMigrationProvider({
        fs: fs_1.promises,
        path,
        migrationFolder,
    }),
});
(0, kysely_migration_cli_1.run)(db, migrator, migrationFolder);
//# sourceMappingURL=migrate.js.map