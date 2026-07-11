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
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const export_service_1 = require("./export.service");
const export_dto_1 = require("./dto/export-dto");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const space_ability_factory_1 = require("../../core/casl/abilities/space-ability.factory");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const page_repo_1 = require("../../database/repos/page/page.repo");
const page_access_service_1 = require("../../core/page/page-access/page-access.service");
const space_ability_type_1 = require("../../core/casl/interfaces/space-ability.type");
const utils_1 = require("./utils");
const helpers_1 = require("../../common/helpers");
const path = require("path");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let ExportController = class ExportController {
    constructor(exportService, pageRepo, spaceAbility, pageAccessService, auditService) {
        this.exportService = exportService;
        this.pageRepo = pageRepo;
        this.spaceAbility = spaceAbility;
        this.pageAccessService = pageAccessService;
        this.auditService = auditService;
    }
    async exportPage(dto, user, res) {
        const page = await this.pageRepo.findById(dto.pageId, {
            includeContent: true,
        });
        if (!page || page.deletedAt) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        const result = await this.exportService.exportPages(dto.pageId, dto.format, dto.includeAttachments, dto.includeChildren, user.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.PAGE_EXPORTED,
            resourceType: audit_events_1.AuditResource.PAGE,
            resourceId: page.id,
            spaceId: page.spaceId,
            metadata: {
                title: (0, helpers_1.getPageTitle)(page.title),
                format: dto.format,
                includeChildren: dto.includeChildren,
                includeAttachments: dto.includeAttachments,
                spaceId: page.spaceId,
            },
        });
        if (result.type === 'file') {
            const ext = (0, utils_1.getExportExtension)(dto.format);
            const fileName = (0, helpers_1.sanitizeFileName)(page.title || 'untitled', { preserveSpaces: true }) +
                ext;
            const contentType = (0, helpers_1.getMimeType)(path.extname(fileName));
            res.headers({
                'Content-Type': contentType,
                'Content-Disposition': 'attachment; filename="' + encodeURIComponent(fileName) + '"',
            });
            res.send(result.content);
        }
        else {
            const fileName = (0, helpers_1.sanitizeFileName)(page.title || 'untitled', { preserveSpaces: true }) +
                '.zip';
            res.headers({
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="' + encodeURIComponent(fileName) + '"',
            });
            res.send(result.stream);
        }
    }
    async exportSpace(dto, user, res) {
        const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        const exportFile = await this.exportService.exportSpace(dto.spaceId, dto.format, dto.includeAttachments, user.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.SPACE_EXPORTED,
            resourceType: audit_events_1.AuditResource.SPACE,
            resourceId: dto.spaceId,
            spaceId: dto.spaceId,
            metadata: {
                format: dto.format,
                includeAttachments: dto.includeAttachments ?? false,
                spaceName: exportFile.spaceName,
            },
        });
        res.headers({
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="' +
                encodeURIComponent((0, helpers_1.sanitizeFileName)(exportFile.fileName, { preserveSpaces: true })) +
                '"',
        });
        res.send(exportFile.fileStream);
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('pages/export'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_dto_1.ExportPageDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "exportPage", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('spaces/export'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_dto_1.ExportSpaceDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "exportSpace", null);
exports.ExportController = ExportController = __decorate([
    (0, common_1.Controller)(),
    __param(4, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [export_service_1.ExportService,
        page_repo_1.PageRepo,
        space_ability_factory_1.default,
        page_access_service_1.PageAccessService, Object])
], ExportController);
//# sourceMappingURL=export.controller.js.map