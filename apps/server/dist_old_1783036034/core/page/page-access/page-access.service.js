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
exports.PageAccessService = void 0;
const common_1 = require("@nestjs/common");
const page_permission_repo_1 = require("../../../database/repos/page/page-permission.repo");
const space_ability_factory_1 = require("../../casl/abilities/space-ability.factory");
const space_ability_type_1 = require("../../casl/interfaces/space-ability.type");
const space_repo_1 = require("../../../database/repos/space/space.repo");
let PageAccessService = class PageAccessService {
    constructor(pagePermissionRepo, spaceAbility, spaceRepo) {
        this.pagePermissionRepo = pagePermissionRepo;
        this.spaceAbility = spaceAbility;
        this.spaceRepo = spaceRepo;
    }
    async validateCanView(page, user) {
        const ability = await this.spaceAbility.createForUser(user, page.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        const canAccess = await this.pagePermissionRepo.canUserAccessPage(user.id, page.id);
        if (!canAccess) {
            throw new common_1.ForbiddenException();
        }
    }
    async validateCanViewWithPermissions(page, user) {
        const ability = await this.spaceAbility.createForUser(user, page.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        const { hasAnyRestriction, canAccess, canEdit } = await this.pagePermissionRepo.canUserEditPage(user.id, page.id);
        if (hasAnyRestriction && !canAccess) {
            throw new common_1.ForbiddenException();
        }
        return {
            canEdit: hasAnyRestriction
                ? canEdit
                : ability.can(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page),
            hasRestriction: hasAnyRestriction,
        };
    }
    async validateCanEdit(page, user) {
        const ability = await this.spaceAbility.createForUser(user, page.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        const { hasAnyRestriction, canEdit } = await this.pagePermissionRepo.canUserEditPage(user.id, page.id);
        if (hasAnyRestriction) {
            if (!canEdit) {
                throw new common_1.ForbiddenException();
            }
        }
        else {
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Edit, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
        }
        return { hasRestriction: hasAnyRestriction };
    }
    async validateCanComment(page, user, workspaceId) {
        try {
            await this.validateCanEdit(page, user);
            return;
        }
        catch {
        }
        await this.validateCanView(page, user);
        const space = await this.spaceRepo.findById(page.spaceId, workspaceId);
        const settings = space?.settings;
        if (!settings?.comments?.allowViewerComments) {
            throw new common_1.ForbiddenException();
        }
    }
};
exports.PageAccessService = PageAccessService;
exports.PageAccessService = PageAccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [page_permission_repo_1.PagePermissionRepo,
        space_ability_factory_1.default,
        space_repo_1.SpaceRepo])
], PageAccessService);
//# sourceMappingURL=page-access.service.js.map