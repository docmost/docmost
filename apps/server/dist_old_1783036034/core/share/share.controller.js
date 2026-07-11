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
exports.ShareController = void 0;
const common_1 = require("@nestjs/common");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const share_service_1 = require("./share.service");
const share_dto_1 = require("./dto/share.dto");
const share_transclusion_lookup_dto_1 = require("./dto/share-transclusion-lookup.dto");
const page_repo_1 = require("../../database/repos/page/page.repo");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const page_access_service_1 = require("../page/page-access/page-access.service");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const share_repo_1 = require("../../database/repos/share/share.repo");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const license_check_service_1 = require("../../integrations/environment/license-check.service");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let ShareController = class ShareController {
    constructor(shareService, shareRepo, pageRepo, pagePermissionRepo, pageAccessService, licenseCheckService, auditService) {
        this.shareService = shareService;
        this.shareRepo = shareRepo;
        this.pageRepo = pageRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.pageAccessService = pageAccessService;
        this.licenseCheckService = licenseCheckService;
        this.auditService = auditService;
    }
    async getShares(user, pagination) {
        return this.shareRepo.getShares(user.id, pagination);
    }
    async getSharedPageInfo(dto, workspace) {
        if (!dto.pageId && !dto.shareId) {
            throw new common_1.BadRequestException();
        }
        const shareData = await this.shareService.getSharedPage(dto, workspace.id);
        const sharingAllowed = await this.shareService.isSharingAllowed(workspace.id, shareData.share.spaceId);
        if (!sharingAllowed) {
            throw new common_1.NotFoundException('Shared page not found');
        }
        return {
            ...shareData,
            features: this.licenseCheckService.resolveFeatures(workspace.licenseKey, workspace.plan),
        };
    }
    async getShare(dto) {
        const share = await this.shareRepo.findById(dto.shareId, {
            includeSharedPage: true,
        });
        if (!share) {
            throw new common_1.NotFoundException('Share not found');
        }
        const sharingAllowed = await this.shareService.isSharingAllowed(share.workspaceId, share.spaceId);
        if (!sharingAllowed) {
            throw new common_1.NotFoundException('Share not found');
        }
        return share;
    }
    async transclusionLookup(dto, workspace) {
        return this.shareService.lookupTransclusionForShare(dto.shareId, dto.references, workspace.id);
    }
    async getShareForPage(dto, user, workspace) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Shared page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.shareService.getShareForPage(page.id, workspace.id);
    }
    async create(createShareDto, user, workspace) {
        const page = await this.pageRepo.findById(createShareDto.pageId);
        if (!page || workspace.id !== page.workspaceId) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        const isRestricted = await this.pagePermissionRepo.hasRestrictedAncestor(page.id);
        if (isRestricted) {
            throw new common_1.BadRequestException('Cannot share a restricted page');
        }
        const sharingAllowed = await this.shareService.isSharingAllowed(workspace.id, page.spaceId);
        if (!sharingAllowed) {
            throw new common_1.ForbiddenException('Public sharing is disabled');
        }
        const share = await this.shareService.createShare({
            page,
            authUserId: user.id,
            workspaceId: workspace.id,
            createShareDto,
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.SHARE_CREATED,
            resourceType: audit_events_1.AuditResource.SHARE,
            resourceId: share.id,
            spaceId: page.spaceId,
            metadata: {
                pageId: page.id,
                spaceId: page.spaceId,
            },
        });
        return share;
    }
    async update(updateShareDto, user) {
        const share = await this.shareRepo.findById(updateShareDto.shareId);
        if (!share) {
            throw new common_1.NotFoundException('Share not found');
        }
        const page = await this.pageRepo.findById(share.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        return this.shareService.updateShare(share.id, updateShareDto);
    }
    async delete(shareIdDto, user) {
        const share = await this.shareRepo.findById(shareIdDto.shareId);
        if (!share) {
            throw new common_1.NotFoundException('Share not found');
        }
        const page = await this.pageRepo.findById(share.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        await this.shareRepo.deleteShare(share.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.SHARE_DELETED,
            resourceType: audit_events_1.AuditResource.SHARE,
            resourceId: share.id,
            spaceId: share.spaceId,
            changes: {
                before: {
                    pageId: share.pageId,
                    spaceId: share.spaceId,
                },
            },
        });
    }
    async getSharePageTree(dto, workspace) {
        const treeData = await this.shareService.getShareTree(dto.shareId, workspace.id);
        const sharingAllowed = await this.shareService.isSharingAllowed(workspace.id, treeData.share.spaceId);
        if (!sharingAllowed) {
            throw new common_1.NotFoundException('Share not found');
        }
        return {
            ...treeData,
            features: this.licenseCheckService.resolveFeatures(workspace.licenseKey, workspace.plan),
        };
    }
};
exports.ShareController = ShareController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/'),
    __param(0, (0, auth_user_decorator_1.AuthUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_options_1.PaginationOptions]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getShares", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/page-info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.ShareInfoDto, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getSharedPageInfo", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/info'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.ShareIdDto]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getShare", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/transclusion/lookup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_transclusion_lookup_dto_1.ShareTransclusionLookupDto, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "transclusionLookup", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/for-page'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.SharePageIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getShareForPage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.CreateShareDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "create", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.UpdateShareDto, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.ShareIdDto, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "delete", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/tree'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [share_dto_1.ShareIdDto, Object]),
    __metadata("design:returntype", Promise)
], ShareController.prototype, "getSharePageTree", null);
exports.ShareController = ShareController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('shares'),
    __param(6, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [share_service_1.ShareService,
        share_repo_1.ShareRepo,
        page_repo_1.PageRepo,
        page_permission_repo_1.PagePermissionRepo,
        page_access_service_1.PageAccessService,
        license_check_service_1.LicenseCheckService, Object])
], ShareController);
//# sourceMappingURL=share.controller.js.map