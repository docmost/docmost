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
var PostgresHealthIndicator_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresHealthIndicator = void 0;
const nestjs_kysely_1 = require("nestjs-kysely");
const terminus_1 = require("@nestjs/terminus");
const common_1 = require("@nestjs/common");
const kysely_1 = require("kysely");
let PostgresHealthIndicator = PostgresHealthIndicator_1 = class PostgresHealthIndicator {
    constructor(healthIndicatorService, db) {
        this.healthIndicatorService = healthIndicatorService;
        this.db = db;
        this.logger = new common_1.Logger(PostgresHealthIndicator_1.name);
    }
    async pingCheck(key) {
        const indicator = this.healthIndicatorService.check(key);
        try {
            await (0, kysely_1.sql) `SELECT 1=1`.execute(this.db);
            return indicator.up();
        }
        catch (e) {
            this.logger.error(JSON.stringify(e));
            return indicator.down(`${key} is not available`);
        }
    }
};
exports.PostgresHealthIndicator = PostgresHealthIndicator;
exports.PostgresHealthIndicator = PostgresHealthIndicator = PostgresHealthIndicator_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [terminus_1.HealthIndicatorService, Object])
], PostgresHealthIndicator);
//# sourceMappingURL=postgres.health.js.map