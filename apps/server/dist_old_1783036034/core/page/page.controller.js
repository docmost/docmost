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
exports.PageController = void 0;
const common_1 = require("@nestjs/common");
const page_service_1 = require("./services/page.service");
const backlink_service_1 = require("./services/backlink.service");
const page_access_service_1 = require("./page-access/page-access.service");
const create_page_dto_1 = require("./dto/create-page.dto");
const update_page_dto_1 = require("./dto/update-page.dto");
const move_page_dto_1 = require("./dto/move-page.dto");
const page_dto_1 = require("./dto/page.dto");
const page_history_service_1 = require("./services/page-history.service");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const sidebar_page_dto_1 = require("./dto/sidebar-page.dto");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const page_repo_1 = require("../../database/repos/page/page.repo");
const recent_page_dto_1 = require("./dto/recent-page.dto");
const created_by_user_dto_1 = require("./dto/created-by-user.dto");
const duplicate_page_dto_1 = require("./dto/duplicate-page.dto");
const deleted_page_dto_1 = require("./dto/deleted-page.dto");
const backlink_dto_1 = require("./dto/backlink.dto");
const label_service_1 = require("../label/label.service");
const label_dto_1 = require("../label/dto/label.dto");
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
const helpers_1 = require("../../common/helpers");
let PageController = class PageController {
    constructor(pageService, pageRepo, pageHistoryService, spaceAbility, pageAccessService, backlinkService, labelService, auditService) {
        this.pageService = pageService;
        this.pageRepo = pageRepo;
        this.pageHistoryService = pageHistoryService;
        this.spaceAbility = spaceAbility;
        this.pageAccessService = pageAccessService;
        this.backlinkService = backlinkService;
        this.labelService = labelService;
        this.auditService = auditService;
    }
    async getPage(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId, {
            includeSpace: true,
            includeContent: true,
            includeCreator: true,
            includeLastUpdatedBy: true,
            includeContributors: true,
            includeDeletedBy: true,
        });
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        const { canEdit, hasRestriction } = await this.pageAccessService.validateCanViewWithPermissions(page, user);
        const permissions = { canEdit, hasRestriction };
        if (dto.format && dto.format !== 'json' && page.content) {
            const contentOutput = dto.format === 'markdown'
                ? (0, collaboration_util_1.jsonToMarkdown)(page.content)
                : (0, collaboration_util_1.jsonToHtml)(page.content);
            return {
                ...page,
                content: contentOutput,
                permissions,
            };
        }
        return { ...page, permissions };
    }
    async getPageLabels(dto, pagination, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.labelService.getPageLabels(page.id, pagination);
    }
    async addPageLabels(dto, user, workspace) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page || page.deletedAt) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        return this.labelService.addLabelsToPage(page.id, dto.names, workspace.id);
    }
    async removePageLabel(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page || page.deletedAt) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanEdit(page, user);
        await this.labelService.removeLabelFromPage(page.id, dto.labelId, page.workspaceId);
    }
    async getBacklinksCount(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.backlinkService.countByPageId(page.id, user.id);
    }
    async getBacklinks(dto, pagination, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.backlinkService.findByPageId(page.id, dto.direction, user.id, pagination);
    }
    async create(createPageDto, user, workspace) {
        if (createPageDto.parentPageId) {
            const parentPage = await this.pageRepo.findById(createPageDto.parentPageId);
            if (!parentPage ||
                parentPage.deletedAt ||
                parentPage.spaceId !== createPageDto.spaceId) {
                throw new common_1.NotFoundException('Parent page not found');
            }
            await this.pageAccessService.validateCanEdit(parentPage, user);
        }
        else {
            const ability = await this.spaceAbility.createForUser(user, createPageDto.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Create, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
        }
        const page = await this.pageService.create(user.id, workspace.id, createPageDto);
        const { canEdit, hasRestriction } = await this.pageAccessService.validateCanViewWithPermissions(page, user);
        const permissions = { canEdit, hasRestriction };
        this.auditService.log({
            event: audit_events_1.AuditEvent.PAGE_CREATED,
            resourceType: audit_events_1.AuditResource.PAGE,
            resourceId: page.id,
            spaceId: page.spaceId,
            changes: {
                after: {
                    title: (0, helpers_1.getPageTitle)(page.title),
                    spaceId: page.spaceId,
                },
            },
        });
        if (createPageDto.format &&
            createPageDto.format !== 'json' &&
            page.content) {
            const contentOutput = createPageDto.format === 'markdown'
                ? (0, collaboration_util_1.jsonToMarkdown)(page.content)
                : (0, collaboration_util_1.jsonToHtml)(page.content);
            return { ...page, content: contentOutput, permissions };
        }
        return { ...page, permissions };
    }
    async update(updatePageDto, user) {
        const page = await this.pageRepo.findById(updatePageDto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        const { hasRestriction } = await this.pageAccessService.validateCanEdit(page, user);
        const updatedPage = await this.pageService.update(page, updatePageDto, user);
        const permissions = { canEdit: true, hasRestriction };
        if (updatePageDto.format &&
            updatePageDto.format !== 'json' &&
            updatedPage.content) {
            const contentOutput = updatePageDto.format === 'markdown'
                ? (0, collaboration_util_1.jsonToMarkdown)(updatedPage.content)
                : (0, collaboration_util_1.jsonToHtml)(updatedPage.content);
            return { ...updatedPage, content: contentOutput, permissions };
        }
        return { ...updatedPage, permissions };
    }
    async delete(deletePageDto, user, workspace) {
        const page = await this.pageRepo.findById(deletePageDto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        const ability = await this.spaceAbility.createForUser(user, page.spaceId);
        if (deletePageDto.permanentlyDelete) {
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException('Only space admins can permanently delete pages');
            }
            await this.pageService.forceDelete(deletePageDto.pageId, workspace.id);
            this.auditService.log({
                event: audit_events_1.AuditEvent.PAGE_DELETED,
                resourceType: audit_events_1.AuditResource.PAGE,
                resourceId: page.id,
                spaceId: page.spaceId,
                changes: {
                    before: {
                        pageId: page.id,
                        slugId: page.slugId,
                        title: (0, helpers_1.getPageTitle)(page.title),
                        spaceId: page.spaceId,
                    },
                },
            });
        }
        else {
            await this.pageAccessService.validateCanEdit(page, user);
            await this.pageService.removePage(deletePageDto.pageId, user.id, workspace.id);
            this.auditService.log({
                event: audit_events_1.AuditEvent.PAGE_TRASHED,
                resourceType: audit_events_1.AuditResource.PAGE,
                resourceId: page.id,
                spaceId: page.spaceId,
                changes: {
                    before: {
                        pageId: page.id,
                        slugId: page.slugId,
                        title: (0, helpers_1.getPageTitle)(page.title),
                        spaceId: page.spaceId,
                    },
                },
            });
        }
    }
    async restore(pageIdDto, user, workspace) {
        const page = await this.pageRepo.findById(pageIdDto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        const ability = await this.spaceAbility.createForUser(user, page.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        await this.pageAccessService.validateCanEdit(page, user);
        await this.pageRepo.restorePage(pageIdDto.pageId, workspace.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.PAGE_RESTORED,
            resourceType: audit_events_1.AuditResource.PAGE,
            resourceId: page.id,
            spaceId: page.spaceId,
            changes: {
                after: {
                    title: (0, helpers_1.getPageTitle)(page.title),
                    spaceId: page.spaceId,
                },
            },
        });
        return this.pageRepo.findById(pageIdDto.pageId, {
            includeHasChildren: true,
        });
    }
    async getRecentPages(recentPageDto, pagination, user) {
        if (recentPageDto.spaceId) {
            const ability = await this.spaceAbility.createForUser(user, recentPageDto.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
            return this.pageService.getRecentSpacePages(recentPageDto.spaceId, user.id, pagination);
        }
        return this.pageService.getRecentPages(user.id, pagination);
    }
    async getCreatedByPages(dto, pagination, user) {
        const targetUserId = dto.userId ?? user.id;
        if (dto.spaceId) {
            const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
        }
        return this.pageService.getCreatedByPages(targetUserId, user.id, pagination, dto.spaceId);
    }
    async getDeletedPages(deletedPageDto, pagination, user) {
        if (deletedPageDto.spaceId) {
            const ability = await this.spaceAbility.createForUser(user, deletedPageDto.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
            return this.pageService.getDeletedSpacePages(deletedPageDto.spaceId, user.id, pagination);
        }
    }
    async getPageHistory(dto, pagination, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.pageHistoryService.findHistoryByPageId(page.id, pagination);
    }
    async getPageHistoryInfo(dto, user) {
        const history = await this.pageHistoryService.findById(dto.historyId);
        if (!history) {
            throw new common_1.NotFoundException('Page history not found');
        }
        const page = await this.pageRepo.findById(history.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return history;
    }
    async getSidebarPages(dto, pagination, user) {
        if (!dto.spaceId && !dto.pageId) {
            throw new common_1.BadRequestException('Either spaceId or pageId must be provided');
        }
        let spaceId = dto.spaceId;
        if (dto.pageId) {
            const page = await this.pageRepo.findById(dto.pageId);
            if (!page) {
                throw new common_1.ForbiddenException();
            }
            spaceId = page.spaceId;
        }
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        const spaceCanEdit = ability.can(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page);
        return this.pageService.getSidebarPages(spaceId, pagination, dto.pageId, user.id, spaceCanEdit);
    }
    async movePageToSpace(dto, user) {
        const movedPage = await this.pageRepo.findById(dto.pageId);
        if (!movedPage) {
            throw new common_1.NotFoundException('Page to move not found');
        }
        if (movedPage.spaceId === dto.spaceId) {
            throw new common_1.BadRequestException('Page is already in this space');
        }
        const abilities = await Promise.all([
            this.spaceAbility.createForUser(user, movedPage.spaceId),
            this.spaceAbility.createForUser(user, dto.spaceId),
        ]);
        if (abilities.some((ability) => ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page))) {
            throw new common_1.ForbiddenException();
        }
        await this.pageAccessService.validateCanEdit(movedPage, user);
        const { childPageIds } = await this.pageService.movePageToSpace(movedPage, dto.spaceId, user.id);
        this.auditService.log({
            event: audit_events_1.AuditEvent.PAGE_MOVED_TO_SPACE,
            resourceType: audit_events_1.AuditResource.PAGE,
            resourceId: movedPage.id,
            spaceId: movedPage.spaceId,
            changes: {
                before: { spaceId: movedPage.spaceId },
                after: { spaceId: dto.spaceId },
            },
            metadata: {
                title: (0, helpers_1.getPageTitle)(movedPage.title),
                ...(childPageIds.length > 0 && { childPageIds }),
            },
        });
    }
    async duplicatePage(dto, user) {
        const copiedPage = await this.pageRepo.findById(dto.pageId);
        if (!copiedPage) {
            throw new common_1.NotFoundException('Page to copy not found');
        }
        await this.pageAccessService.validateCanView(copiedPage, user);
        let result;
        if (dto.spaceId) {
            const abilities = await Promise.all([
                this.spaceAbility.createForUser(user, copiedPage.spaceId),
                this.spaceAbility.createForUser(user, dto.spaceId),
            ]);
            if (abilities.some((ability) => ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page))) {
                throw new common_1.ForbiddenException();
            }
            result = await this.pageService.duplicatePage(copiedPage, dto.spaceId, user);
            this.auditService.log({
                event: audit_events_1.AuditEvent.PAGE_DUPLICATED,
                resourceType: audit_events_1.AuditResource.PAGE,
                resourceId: result.id,
                spaceId: dto.spaceId,
                metadata: {
                    sourcePageId: copiedPage.id,
                    title: (0, helpers_1.getPageTitle)(copiedPage.title),
                    sourceSpaceId: copiedPage.spaceId,
                    targetSpaceId: dto.spaceId,
                    ...(result.childPageIds.length > 0 && {
                        childPageIds: result.childPageIds,
                    }),
                },
            });
        }
        else {
            const ability = await this.spaceAbility.createForUser(user, copiedPage.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
            result = await this.pageService.duplicatePage(copiedPage, undefined, user);
            this.auditService.log({
                event: audit_events_1.AuditEvent.PAGE_DUPLICATED,
                resourceType: audit_events_1.AuditResource.PAGE,
                resourceId: result.id,
                spaceId: copiedPage.spaceId,
                metadata: {
                    sourcePageId: copiedPage.id,
                    title: (0, helpers_1.getPageTitle)(copiedPage.title),
                    ...(result.childPageIds.length > 0 && {
                        childPageIds: result.childPageIds,
                    }),
                },
            });
        }
        return result;
    }
    async movePage(dto, user) {
        const movedPage = await this.pageRepo.findById(dto.pageId);
        if (!movedPage) {
            throw new common_1.NotFoundException('Moved page not found');
        }
        const ability = await this.spaceAbility.createForUser(user, movedPage.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        await this.pageAccessService.validateCanEdit(movedPage, user);
        if (dto.parentPageId && dto.parentPageId !== movedPage.parentPageId) {
            const targetParent = await this.pageRepo.findById(dto.parentPageId);
            if (!targetParent || targetParent.deletedAt) {
                throw new common_1.NotFoundException('Target parent page not found');
            }
            await this.pageAccessService.validateCanEdit(targetParent, user);
        }
        return this.pageService.movePage(dto, movedPage);
    }
    async getPageBreadcrumbs(dto, user) {
        const page = await this.pageRepo.findById(dto.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.pageService.getPageBreadCrumbs(page.id);
    }
};
exports.PageController = PageController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageInfoDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getPage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('labels'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageIdDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getPageLabels", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('labels/add'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [label_dto_1.AddLabelsDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "addPageLabels", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('labels/remove'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [label_dto_1.RemoveLabelDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "removePageLabel", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('backlinks-count'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageIdDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getBacklinksCount", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('backlinks'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [backlink_dto_1.BacklinksListDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getBacklinks", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_page_dto_1.CreatePageDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "create", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_page_dto_1.UpdatePageDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.DeletePageDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "delete", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('restore'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "restore", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('recent'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [recent_page_dto_1.RecentPageDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getRecentPages", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('created-by-user'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [created_by_user_dto_1.CreatedByUserDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getCreatedByPages", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('trash'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [deleted_page_dto_1.DeletedPageDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getDeletedPages", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/history'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageIdDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getPageHistory", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/history/info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageHistoryIdDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getPageHistoryInfo", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/sidebar-pages'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [sidebar_page_dto_1.SidebarPageDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getSidebarPages", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('move-to-space'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [move_page_dto_1.MovePageToSpaceDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "movePageToSpace", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('duplicate'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [duplicate_page_dto_1.DuplicatePageDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "duplicatePage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('move'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [move_page_dto_1.MovePageDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "movePage", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/breadcrumbs'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [page_dto_1.PageIdDto, Object]),
    __metadata("design:returntype", Promise)
], PageController.prototype, "getPageBreadcrumbs", null);
exports.PageController = PageController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('pages'),
    __param(7, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [page_service_1.PageService,
        page_repo_1.PageRepo,
        page_history_service_1.PageHistoryService,
        space_ability_factory_1.default,
        page_access_service_1.PageAccessService,
        backlink_service_1.BacklinkService,
        label_service_1.LabelService, Object])
], PageController);
//# sourceMappingURL=page.controller.js.map