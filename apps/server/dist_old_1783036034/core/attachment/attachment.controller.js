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
var AttachmentController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentController = void 0;
const common_1 = require("@nestjs/common");
const attachment_service_1 = require("./services/attachment.service");
const file_interceptor_1 = require("../../common/interceptors/file.interceptor");
const bytes = require("bytes");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const storage_service_1 = require("../../integrations/storage/storage.service");
const attachment_utils_1 = require("./attachment.utils");
const helpers_1 = require("../../common/helpers");
const attachment_constants_1 = require("./attachment.constants");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const workspace_ability_type_1 = require("../casl/interfaces/workspace-ability.type");
const workspace_ability_factory_1 = require("../casl/abilities/workspace-ability.factory");
const page_repo_1 = require("../../database/repos/page/page.repo");
const attachment_repo_1 = require("../../database/repos/attachment/attachment.repo");
const uuid_1 = require("uuid");
const environment_service_1 = require("../../integrations/environment/environment.service");
const token_service_1 = require("../auth/services/token.service");
const jwt_payload_1 = require("../auth/dto/jwt-payload");
const path = require("path");
const attachment_dto_1 = require("./dto/attachment.dto");
const page_access_service_1 = require("../page/page-access/page-access.service");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
let AttachmentController = AttachmentController_1 = class AttachmentController {
    constructor(attachmentService, storageService, workspaceAbility, spaceAbility, pageRepo, attachmentRepo, environmentService, tokenService, pageAccessService, auditService) {
        this.attachmentService = attachmentService;
        this.storageService = storageService;
        this.workspaceAbility = workspaceAbility;
        this.spaceAbility = spaceAbility;
        this.pageRepo = pageRepo;
        this.attachmentRepo = attachmentRepo;
        this.environmentService = environmentService;
        this.tokenService = tokenService;
        this.pageAccessService = pageAccessService;
        this.auditService = auditService;
        this.logger = new common_1.Logger(AttachmentController_1.name);
    }
    async uploadFile(req, res, user, workspace) {
        const maxFileSize = bytes(this.environmentService.getFileUploadSizeLimit());
        let file = null;
        try {
            file = await req.file({
                limits: { fileSize: maxFileSize, fields: 3, files: 1 },
            });
        }
        catch (err) {
            this.logger.error(err.message);
            if (err?.statusCode === 413) {
                throw new common_1.BadRequestException(`File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`);
            }
        }
        if (!file) {
            throw new common_1.BadRequestException('Failed to upload file');
        }
        const pageId = file.fields?.pageId?.value;
        if (!pageId) {
            throw new common_1.BadRequestException('PageId is required');
        }
        const page = await this.pageRepo.findById(pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        const spaceId = page.spaceId;
        const attachmentId = file.fields?.attachmentId?.value;
        if (attachmentId && !(0, uuid_1.validate)(attachmentId)) {
            throw new common_1.BadRequestException('Invalid attachment id');
        }
        try {
            const fileResponse = await this.attachmentService.uploadFile({
                filePromise: file,
                pageId: pageId,
                spaceId: spaceId,
                userId: user.id,
                workspaceId: workspace.id,
                attachmentId: attachmentId,
            });
            this.auditService.log({
                event: audit_events_1.AuditEvent.ATTACHMENT_UPLOADED,
                resourceType: audit_events_1.AuditResource.ATTACHMENT,
                resourceId: fileResponse?.id ?? attachmentId,
                spaceId,
                metadata: {
                    fileName: fileResponse?.fileName,
                    pageId,
                    spaceId,
                },
            });
            return res.send(fileResponse);
        }
        catch (err) {
            if (err?.statusCode === 413) {
                const errMessage = `File too large. Exceeds the ${this.environmentService.getFileUploadSizeLimit()} limit`;
                this.logger.error(errMessage);
                throw new common_1.BadRequestException(errMessage);
            }
            this.logger.error(err);
            throw new common_1.BadRequestException('Error processing file upload.');
        }
    }
    async getFile(req, res, user, workspace, fileId, fileName) {
        if (!(0, uuid_1.validate)(fileId)) {
            throw new common_1.NotFoundException('Invalid file id');
        }
        const attachment = await this.attachmentRepo.findById(fileId);
        if (!attachment || attachment.workspaceId !== workspace.id) {
            throw new common_1.NotFoundException();
        }
        if (attachment.aiChatId) {
            if (attachment.creatorId !== user.id) {
                throw new common_1.NotFoundException();
            }
        }
        else {
            if (!attachment.pageId || !attachment.spaceId) {
                throw new common_1.NotFoundException();
            }
            const page = await this.pageRepo.findById(attachment.pageId);
            if (!page) {
                throw new common_1.NotFoundException();
            }
            await this.pageAccessService.validateCanView(page, user);
        }
        try {
            return await this.sendFileResponse(req, res, attachment, 'private');
        }
        catch (err) {
            this.logger.error(err);
            throw new common_1.NotFoundException('File not found');
        }
    }
    async getPublicFile(req, res, workspace, fileId, fileName, jwtToken) {
        let jwtPayload = null;
        try {
            jwtPayload = await this.tokenService.verifyJwt(jwtToken, jwt_payload_1.JwtType.ATTACHMENT);
        }
        catch (err) {
            throw new common_1.BadRequestException('Expired or invalid attachment access token');
        }
        if (!(0, uuid_1.validate)(fileId) ||
            fileId !== jwtPayload.attachmentId ||
            jwtPayload.workspaceId !== workspace.id) {
            throw new common_1.NotFoundException('File not found');
        }
        const attachment = await this.attachmentRepo.findById(fileId);
        if (!attachment ||
            attachment.workspaceId !== workspace.id ||
            !attachment.pageId ||
            !attachment.spaceId ||
            jwtPayload.pageId !== attachment.pageId) {
            throw new common_1.NotFoundException('File not found');
        }
        try {
            return await this.sendFileResponse(req, res, attachment, 'public');
        }
        catch (err) {
            this.logger.error(err);
            throw new common_1.NotFoundException('File not found');
        }
    }
    async uploadAvatarOrLogo(req, res, user, workspace) {
        const maxFileSize = bytes(attachment_constants_1.MAX_AVATAR_SIZE);
        let file = null;
        try {
            file = await req.file({
                limits: { fileSize: maxFileSize, fields: 3, files: 1 },
            });
        }
        catch (err) {
            if (err?.statusCode === 413) {
                throw new common_1.BadRequestException(`File too large. Exceeds the ${attachment_constants_1.MAX_AVATAR_SIZE} limit`);
            }
        }
        if (!file) {
            throw new common_1.BadRequestException('Invalid file upload');
        }
        const attachmentType = file.fields?.type?.value;
        const spaceId = file.fields?.spaceId?.value;
        if (!attachmentType) {
            throw new common_1.BadRequestException('attachment type is required');
        }
        if (!attachment_utils_1.validAttachmentTypes.includes(attachmentType) ||
            attachmentType === attachment_constants_1.AttachmentType.File) {
            throw new common_1.BadRequestException('Invalid image attachment type');
        }
        if (attachmentType === attachment_constants_1.AttachmentType.WorkspaceIcon) {
            const ability = this.workspaceAbility.createForUser(user, workspace);
            if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException();
            }
        }
        if (attachmentType === attachment_constants_1.AttachmentType.SpaceIcon) {
            if (!spaceId) {
                throw new common_1.BadRequestException('spaceId is required');
            }
            const spaceAbility = await this.spaceAbility.createForUser(user, spaceId);
            if (spaceAbility.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException();
            }
        }
        try {
            const fileResponse = await this.attachmentService.uploadImage(file, attachmentType, user.id, workspace.id, spaceId);
            return res.send(fileResponse);
        }
        catch (err) {
            this.logger.error(err);
            throw new common_1.BadRequestException('Error processing file upload.');
        }
    }
    async getLogoOrAvatar(res, workspace, attachmentType, fileName) {
        if (!attachment_utils_1.validAttachmentTypes.includes(attachmentType) ||
            attachmentType === attachment_constants_1.AttachmentType.File) {
            throw new common_1.BadRequestException('Invalid image attachment type');
        }
        if (!fileName) {
            throw new common_1.BadRequestException('Invalid file name');
        }
        const ext = path.extname(fileName);
        const filenameWithoutExt = path.basename(fileName, ext);
        if (!ext ||
            !(0, uuid_1.validate)(filenameWithoutExt) ||
            `${filenameWithoutExt}${ext}` !== fileName) {
            throw new common_1.BadRequestException('Invalid file name');
        }
        const filePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachmentType, workspace.id)}/${fileName}`;
        try {
            const fileStream = await this.storageService.readStream(filePath);
            res.headers({
                'Content-Type': (0, helpers_1.getMimeType)(filePath),
                'Cache-Control': 'private, max-age=86400',
            });
            return res.send(fileStream);
        }
        catch (err) {
            throw new common_1.NotFoundException('File not found');
        }
    }
    async getAttachmentInfo(dto, workspace, user) {
        const attachment = await this.attachmentRepo.findById(dto.attachmentId);
        if (!attachment ||
            !attachment.pageId ||
            attachment.workspaceId !== workspace.id ||
            attachment.type !== attachment_constants_1.AttachmentType.File) {
            throw new common_1.NotFoundException('File not found');
        }
        const page = await this.pageRepo.findById(attachment.pageId);
        if (!page) {
            throw new common_1.NotFoundException('File not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return attachment;
    }
    async removeIcon(dto, user, workspace) {
        const { type, spaceId } = dto;
        if (type === attachment_constants_1.AttachmentType.Avatar) {
            await this.attachmentService.removeUserAvatar(user);
            return;
        }
        if (type === attachment_constants_1.AttachmentType.SpaceIcon) {
            if (!spaceId) {
                throw new common_1.BadRequestException('spaceId is required to change space icons');
            }
            const spaceAbility = await this.spaceAbility.createForUser(user, spaceId);
            if (spaceAbility.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException();
            }
            await this.attachmentService.removeSpaceIcon(spaceId, workspace.id);
            return;
        }
        if (type === attachment_constants_1.AttachmentType.WorkspaceIcon) {
            const ability = this.workspaceAbility.createForUser(user, workspace);
            if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException();
            }
            await this.attachmentService.removeWorkspaceIcon(workspace);
            return;
        }
    }
    async sendFileResponse(req, res, attachment, cacheScope) {
        const fileSize = Number(attachment.fileSize);
        const rangeHeader = req.headers.range;
        res.header('Accept-Ranges', 'bytes');
        res.header('Content-Security-Policy', "base-uri 'none'; object-src 'self'; default-src 'self';");
        if (!attachment_constants_1.inlineFileExtensions.includes(attachment.fileExt)) {
            res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
        }
        if (rangeHeader && fileSize) {
            const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (match) {
                const start = parseInt(match[1], 10);
                const end = match[2]
                    ? Math.min(parseInt(match[2], 10), fileSize - 1)
                    : fileSize - 1;
                if (start >= fileSize || start > end) {
                    res.status(416);
                    res.header('Content-Range', `bytes */${fileSize}`);
                    return res.send();
                }
                const fileStream = await this.storageService.readRangeStream(attachment.filePath, { start, end });
                res.status(206);
                res.headers({
                    'Content-Type': attachment.mimeType,
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Content-Length': end - start + 1,
                    'Cache-Control': `${cacheScope}, max-age=3600`,
                });
                return res.send(fileStream);
            }
        }
        const fileStream = await this.storageService.readStream(attachment.filePath);
        res.headers({
            'Content-Type': attachment.mimeType,
            'Cache-Control': `${cacheScope}, max-age=3600`,
        });
        const isSvg = attachment.fileExt === '.svg';
        if (fileSize && !isSvg) {
            res.header('Content-Length', fileSize);
        }
        return res.send(fileStream);
    }
};
exports.AttachmentController = AttachmentController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('files/upload'),
    (0, common_1.UseInterceptors)(file_interceptor_1.FileInterceptor),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('/files/:fileId/:fileName'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(4, (0, common_1.Param)('fileId')),
    __param(5, (0, common_1.Param)('fileName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "getFile", null);
__decorate([
    (0, common_1.Get)('/files/public/:fileId/:fileName'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(3, (0, common_1.Param)('fileId')),
    __param(4, (0, common_1.Param)('fileName')),
    __param(5, (0, common_1.Query)('jwt')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "getPublicFile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('attachments/upload-image'),
    (0, common_1.UseInterceptors)(file_interceptor_1.FileInterceptor),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "uploadAvatarOrLogo", null);
__decorate([
    (0, common_1.Get)('attachments/img/:attachmentType/:fileName'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, common_1.Param)('attachmentType')),
    __param(3, (0, common_1.Param)('fileName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "getLogoOrAvatar", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('files/info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attachment_dto_1.AttachmentInfoDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "getAttachmentInfo", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('attachments/remove-icon'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [attachment_dto_1.RemoveIconDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AttachmentController.prototype, "removeIcon", null);
exports.AttachmentController = AttachmentController = AttachmentController_1 = __decorate([
    (0, common_1.Controller)(),
    __param(9, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [attachment_service_1.AttachmentService,
        storage_service_1.StorageService,
        workspace_ability_factory_1.default,
        space_ability_factory_1.default,
        page_repo_1.PageRepo,
        attachment_repo_1.AttachmentRepo,
        environment_service_1.EnvironmentService,
        token_service_1.TokenService,
        page_access_service_1.PageAccessService, Object])
], AttachmentController);
//# sourceMappingURL=attachment.controller.js.map