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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const environment_service_1 = require("../environment/environment.service");
const nestjs_kysely_1 = require("nestjs-kysely");
const node_crypto_1 = require("node:crypto");
const workspace_repo_1 = require("../../database/repos/workspace/workspace.repo");
const packageJson = require('./../../../package.json');
let TelemetryService = class TelemetryService {
    constructor(environmentService, db, workspaceRepo, schedulerRegistry) {
        this.environmentService = environmentService;
        this.db = db;
        this.workspaceRepo = workspaceRepo;
        this.schedulerRegistry = schedulerRegistry;
        this.ENDPOINT_URL = 'https://tel.docmost.com/api/event';
    }
    async sendTelemetry() {
        try {
            if (this.environmentService.isDisableTelemetry() ||
                this.environmentService.isCloud() ||
                this.environmentService.getNodeEnv() !== 'production') {
                this.schedulerRegistry.deleteInterval('telemetry');
                return;
            }
            const workspace = await this.workspaceRepo.findFirst();
            if (!workspace) {
                return;
            }
            const anonymizedHash = (0, node_crypto_1.createHmac)('sha256', this.environmentService.getAppSecret())
                .update(workspace.id)
                .digest('hex');
            const { userCount } = await this.db
                .selectFrom('users')
                .select((eb) => eb.fn.count('id').as('userCount'))
                .executeTakeFirst();
            const { pageCount } = await this.db
                .selectFrom('pages')
                .select((eb) => eb.fn.count('id').as('pageCount'))
                .executeTakeFirst();
            const { workspaceCount } = await this.db
                .selectFrom('workspaces')
                .select((eb) => eb.fn.count('id').as('workspaceCount'))
                .executeTakeFirst();
            const { spaceCount } = await this.db
                .selectFrom('spaces')
                .select((eb) => eb.fn.count('id').as('spaceCount'))
                .executeTakeFirst();
            const data = {
                instanceId: anonymizedHash,
                version: packageJson.version,
                userCount,
                pageCount,
                spaceCount,
                workspaceCount,
            };
            await fetch(this.ENDPOINT_URL, {
                method: 'POST',
                headers: {
                    'User-Agent': 'docmost:' + data.version,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
        }
        catch (err) {
        }
    }
};
exports.TelemetryService = TelemetryService;
__decorate([
    (0, schedule_1.Interval)('telemetry', 24 * 60 * 60 * 1000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TelemetryService.prototype, "sendTelemetry", null);
exports.TelemetryService = TelemetryService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [environment_service_1.EnvironmentService, Object, workspace_repo_1.WorkspaceRepo,
        schedule_1.SchedulerRegistry])
], TelemetryService);
//# sourceMappingURL=telemetry.service.js.map