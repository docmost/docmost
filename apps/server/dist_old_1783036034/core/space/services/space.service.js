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
exports.SpaceService = void 0;
const common_1 = require("@nestjs/common");
const space_repo_1 = require("../../../database/repos/space/space.repo");
const utils_1 = require("../../../database/utils");
const nestjs_kysely_1 = require("nestjs-kysely");
const features_1 = require("../../../common/features");
const space_member_service_1 = require("./space-member.service");
const permission_1 = require("../../../common/helpers/types/permission");
const constants_1 = require("../../../integrations/queue/constants");
const bullmq_1 = require("bullmq");
const bullmq_2 = require("@nestjs/bullmq");
const share_repo_1 = require("../../../database/repos/share/share.repo");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
const license_check_service_1 = require("../../../integrations/environment/license-check.service");
const audit_events_1 = require("../../../common/events/audit-events");
const helpers_1 = require("../../../common/helpers");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let SpaceService = class SpaceService {
    constructor(spaceRepo, spaceMemberService, shareRepo, workspaceRepo, licenseCheckService, db, attachmentQueue, auditService) {
        this.spaceRepo = spaceRepo;
        this.spaceMemberService = spaceMemberService;
        this.shareRepo = shareRepo;
        this.workspaceRepo = workspaceRepo;
        this.licenseCheckService = licenseCheckService;
        this.db = db;
        this.attachmentQueue = attachmentQueue;
        this.auditService = auditService;
    }
    async createSpace(authUser, workspaceId, createSpaceDto, trx) {
        let space = null;
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            space = await this.create(authUser.id, workspaceId, createSpaceDto, trx);
            await this.spaceMemberService.addUserToSpace(authUser.id, space.id, permission_1.SpaceRole.ADMIN, workspaceId, trx);
        }, trx);
        this.auditService.log({
            event: audit_events_1.AuditEvent.SPACE_CREATED,
            resourceType: audit_events_1.AuditResource.SPACE,
            resourceId: space.id,
            spaceId: space.id,
            changes: {
                after: {
                    name: space.name,
                    slug: space.slug,
                },
            },
        });
        return { ...space, memberCount: 1 };
    }
    async create(userId, workspaceId, createSpaceDto, trx) {
        const slugExists = await this.spaceRepo.slugExists(createSpaceDto.slug, workspaceId, trx);
        if (slugExists) {
            throw new common_1.BadRequestException('Space slug exists. Please use a unique space slug');
        }
        return await this.spaceRepo.insertSpace({
            name: createSpaceDto.name ?? 'untitled space',
            description: createSpaceDto.description ?? '',
            creatorId: userId,
            workspaceId: workspaceId,
            slug: createSpaceDto.slug,
        }, trx);
    }
    async updateSpace(updateSpaceDto, workspaceId) {
        if (updateSpaceDto?.slug) {
            const slugExists = await this.spaceRepo.slugExists(updateSpaceDto.slug, workspaceId);
            if (slugExists) {
                throw new common_1.BadRequestException('Space slug exists. Please use a unique space slug');
            }
        }
        if (typeof updateSpaceDto.disablePublicSharing !== 'undefined' ||
            typeof updateSpaceDto.allowViewerComments !== 'undefined') {
            const workspace = await this.workspaceRepo.findById(workspaceId, {
                withLicenseKey: true,
            });
            if (typeof updateSpaceDto.disablePublicSharing !== 'undefined' &&
                !this.licenseCheckService.hasFeature(workspace.licenseKey, features_1.Feature.SECURITY_SETTINGS, workspace.plan)) {
                throw new common_1.ForbiddenException('This feature requires a valid license');
            }
            if (typeof updateSpaceDto.allowViewerComments !== 'undefined' &&
                !this.licenseCheckService.hasFeature(workspace.licenseKey, features_1.Feature.VIEWER_COMMENTS, workspace.plan)) {
                throw new common_1.ForbiddenException('This feature requires a valid license');
            }
        }
        const spaceBefore = await this.spaceRepo.findById(updateSpaceDto.spaceId, workspaceId);
        const settingsBefore = (spaceBefore?.settings ?? {});
        const before = {};
        const after = {};
        let updatedSpace;
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            if (typeof updateSpaceDto.disablePublicSharing !== 'undefined') {
                const prev = settingsBefore?.sharing?.disabled ?? false;
                if (prev !== updateSpaceDto.disablePublicSharing) {
                    before.disablePublicSharing = prev;
                    after.disablePublicSharing = updateSpaceDto.disablePublicSharing;
                }
                await this.spaceRepo.updateSharingSettings(updateSpaceDto.spaceId, workspaceId, 'disabled', updateSpaceDto.disablePublicSharing, trx);
                if (updateSpaceDto.disablePublicSharing) {
                    await this.shareRepo.deleteBySpaceId(updateSpaceDto.spaceId, trx);
                }
            }
            if (typeof updateSpaceDto.allowViewerComments !== 'undefined') {
                const prev = settingsBefore?.comments?.allowViewerComments ?? false;
                if (prev !== updateSpaceDto.allowViewerComments) {
                    before.allowViewerComments = prev;
                    after.allowViewerComments = updateSpaceDto.allowViewerComments;
                }
                await this.spaceRepo.updateCommentSettings(updateSpaceDto.spaceId, workspaceId, 'allowViewerComments', updateSpaceDto.allowViewerComments, trx);
            }
            updatedSpace = await this.spaceRepo.updateSpace({
                name: updateSpaceDto.name,
                description: updateSpaceDto.description,
                slug: updateSpaceDto.slug,
            }, updateSpaceDto.spaceId, workspaceId, trx);
        });
        const columnChanges = (0, helpers_1.diffAuditTrackedFields)(['name', 'slug', 'description'], updateSpaceDto, spaceBefore, updatedSpace);
        if (columnChanges) {
            Object.assign(before, columnChanges.before);
            Object.assign(after, columnChanges.after);
        }
        if (Object.keys(after).length > 0) {
            this.auditService.log({
                event: audit_events_1.AuditEvent.SPACE_UPDATED,
                resourceType: audit_events_1.AuditResource.SPACE,
                resourceId: updateSpaceDto.spaceId,
                spaceId: updateSpaceDto.spaceId,
                changes: { before, after },
            });
        }
        return updatedSpace;
    }
    async getSpaceInfo(spaceId, workspaceId) {
        const space = await this.spaceRepo.findById(spaceId, workspaceId, {
            includeMemberCount: true,
        });
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        return space;
    }
    async getWorkspaceSpaces(workspaceId, pagination) {
        return this.spaceRepo.getSpacesInWorkspace(workspaceId, pagination);
    }
    async deleteSpace(spaceId, workspaceId) {
        const space = await this.spaceRepo.findById(spaceId, workspaceId);
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        await this.spaceRepo.deleteSpace(spaceId, workspaceId);
        await this.attachmentQueue.add(constants_1.QueueJob.DELETE_SPACE_ATTACHMENTS, space);
        this.auditService.log({
            event: audit_events_1.AuditEvent.SPACE_DELETED,
            resourceType: audit_events_1.AuditResource.SPACE,
            resourceId: spaceId,
            spaceId: spaceId,
            changes: {
                before: {
                    name: space.name,
                    slug: space.slug,
                    description: space.description,
                },
            },
        });
    }
};
exports.SpaceService = SpaceService;
exports.SpaceService = SpaceService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, nestjs_kysely_1.InjectKysely)()),
    __param(6, (0, bullmq_2.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __param(7, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [space_repo_1.SpaceRepo,
        space_member_service_1.SpaceMemberService,
        share_repo_1.ShareRepo,
        workspace_repo_1.WorkspaceRepo,
        license_check_service_1.LicenseCheckService, Object, bullmq_1.Queue, Object])
], SpaceService);
//# sourceMappingURL=space.service.js.map