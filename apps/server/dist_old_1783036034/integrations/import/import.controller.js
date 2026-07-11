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
var ImportController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportController = void 0;
const common_1 = require("@nestjs/common");
const space_ability_factory_1 = require("../../core/casl/abilities/space-ability.factory");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const space_ability_type_1 = require("../../core/casl/interfaces/space-ability.type");
const file_interceptor_1 = require("../../common/interceptors/file.interceptor");
const bytes = require("bytes");
const path = require("path");
const import_service_1 = require("./services/import.service");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const environment_service_1 = require("../environment/environment.service");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let ImportController = ImportController_1 = class ImportController {
    constructor(importService, spaceAbility, environmentService, auditService) {
        this.importService = importService;
        this.spaceAbility = spaceAbility;
        this.environmentService = environmentService;
        this.auditService = auditService;
        this.logger = new common_1.Logger(ImportController_1.name);
    }
    async importPage(req, user, workspace) {
        const validFileExtensions = ['.md', '.html', '.docx', '.pdf'];
        const maxFileSize = bytes('30mb');
        let file = null;
        try {
            file = await req.file({
                limits: { fileSize: maxFileSize, fields: 4, files: 1 },
            });
        }
        catch (err) {
            this.logger.error(err.message);
            if (err?.statusCode === 413) {
                throw new common_1.BadRequestException(`File too large. Exceeds the 10mb import limit`);
            }
        }
        if (!file) {
            throw new common_1.BadRequestException('Failed to upload file');
        }
        if (!validFileExtensions.includes(path.extname(file.filename).toLowerCase())) {
            throw new common_1.BadRequestException('Invalid import file type.');
        }
        const spaceId = file.fields?.spaceId?.value;
        if (!spaceId) {
            throw new common_1.BadRequestException('spaceId is required');
        }
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        const createdPage = await this.importService.importPage(file, user.id, spaceId, workspace.id);
        const ext = path.extname(file.filename).toLowerCase();
        const sourceMap = {
            '.md': 'markdown',
            '.html': 'html',
            '.docx': 'docx',
            '.pdf': 'pdf',
        };
        if (createdPage) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.PAGE_CREATED,
                resourceType: audit_events_1.AuditResource.PAGE,
                resourceId: createdPage.id,
                spaceId,
                metadata: {
                    source: sourceMap[ext],
                    fileName: file.filename,
                },
            });
        }
        return createdPage;
    }
    async importZip(req, user, workspace) {
        const validFileExtensions = ['.zip'];
        const maxFileSize = bytes(this.environmentService.getFileImportSizeLimit());
        let file = null;
        try {
            file = await req.file({
                limits: { fileSize: maxFileSize, fields: 3, files: 1 },
            });
        }
        catch (err) {
            this.logger.error(err.message);
            if (err?.statusCode === 413) {
                throw new common_1.BadRequestException(`File too large. Exceeds the ${this.environmentService.getFileImportSizeLimit()} import limit`);
            }
        }
        if (!file) {
            throw new common_1.BadRequestException('Failed to upload file');
        }
        if (!validFileExtensions.includes(path.extname(file.filename).toLowerCase())) {
            throw new common_1.BadRequestException('Invalid import file extension.');
        }
        const spaceId = file.fields?.spaceId?.value;
        const source = file.fields?.source?.value;
        const validZipSources = ['generic', 'notion', 'confluence'];
        if (!validZipSources.includes(source)) {
            throw new common_1.BadRequestException('Invalid import source. Import source must either be generic, notion or confluence.');
        }
        if (!spaceId) {
            throw new common_1.BadRequestException('spaceId is required');
        }
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        this.auditService.log({
            event: audit_events_1.AuditEvent.PAGE_IMPORTED,
            resourceType: audit_events_1.AuditResource.PAGE,
            resourceId: spaceId,
            spaceId,
            metadata: {
                fileName: file.filename,
                source,
                spaceId,
            },
        });
        return this.importService.importZip(file, source, user.id, spaceId, workspace.id);
    }
};
exports.ImportController = ImportController;
__decorate([
    (0, common_1.UseInterceptors)(file_interceptor_1.FileInterceptor),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('pages/import'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ImportController.prototype, "importPage", null);
__decorate([
    (0, common_1.UseInterceptors)(file_interceptor_1.FileInterceptor),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('pages/import-zip'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ImportController.prototype, "importZip", null);
exports.ImportController = ImportController = ImportController_1 = __decorate([
    (0, common_1.Controller)(),
    __param(3, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [import_service_1.ImportService,
        space_ability_factory_1.default,
        environment_service_1.EnvironmentService, Object])
], ImportController);
//# sourceMappingURL=import.controller.js.map