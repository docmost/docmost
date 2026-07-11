"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MigrationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const common_1 = require("@nestjs/common");
const path = require("path");
const fs_1 = require("fs");
const kysely_1 = require("kysely");
const nestjs_kysely_1 = require("nestjs-kysely");
let MigrationService = MigrationService_1 = class MigrationService {
    constructor(db) {
        this.db = db;
        this.logger = new common_1.Logger(`Database${MigrationService_1.name}`);
    }
    async migrateToLatest() {
        const migrator = new kysely_1.Migrator({
            db: this.db,
            provider: new kysely_1.FileMigrationProvider({
                fs: fs_1.promises,
                path,
                migrationFolder: path.join(__dirname, '..', 'migrations'),
            }),
        });
        const { error, results } = await migrator.migrateToLatest();
        if (results && results.length === 0) {
            this.logger.log('No pending database migrations');
            return;
        }
        results?.forEach((it) => {
            if (it.status === 'Success') {
                this.logger.log(`Migration "${it.migrationName}" executed successfully`);
            }
            else if (it.status === 'Error') {
                this.logger.error(`Failed to execute migration "${it.migrationName}"`);
            }
        });
        if (error) {
            this.logger.error('Failed to run database migration. Exiting program.');
            this.logger.error(error);
            process.exit(1);
        }
    }
};
exports.MigrationService = MigrationService;
exports.MigrationService = MigrationService = MigrationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [Object])
], MigrationService);
//# sourceMappingURL=migration.service.js.map