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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionController = void 0;
const common_1 = require("@nestjs/common");
const version_service_1 = require("./version.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const environment_service_1 = require("../environment/environment.service");
let VersionController = class VersionController {
    constructor(versionService, environmentService) {
        this.versionService = versionService;
        this.environmentService = environmentService;
    }
    async getVersion() {
        if (this.environmentService.isCloud())
            throw new common_1.NotFoundException();
        return this.versionService.getVersion();
    }
};
exports.VersionController = VersionController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VersionController.prototype, "getVersion", null);
exports.VersionController = VersionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('version'),
    __metadata("design:paramtypes", [version_service_1.VersionService,
        environment_service_1.EnvironmentService])
], VersionController);
//# sourceMappingURL=version.controller.js.map