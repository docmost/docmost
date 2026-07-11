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
var AuthenticationExtension_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationExtension = void 0;
const common_1 = require("@nestjs/common");
const token_service_1 = require("../../core/auth/services/token.service");
const user_repo_1 = require("../../database/repos/user/user.repo");
const page_repo_1 = require("../../database/repos/page/page.repo");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const utils_1 = require("../../database/repos/space/utils");
const permission_1 = require("../../common/helpers/types/permission");
const helpers_1 = require("../../common/helpers");
const collaboration_util_1 = require("../collaboration.util");
const jwt_payload_1 = require("../../core/auth/dto/jwt-payload");
let AuthenticationExtension = AuthenticationExtension_1 = class AuthenticationExtension {
    constructor(tokenService, userRepo, pageRepo, spaceMemberRepo, pagePermissionRepo) {
        this.tokenService = tokenService;
        this.userRepo = userRepo;
        this.pageRepo = pageRepo;
        this.spaceMemberRepo = spaceMemberRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.logger = new common_1.Logger(AuthenticationExtension_1.name);
    }
    async onAuthenticate(data) {
        const { documentName, token } = data;
        const pageId = (0, collaboration_util_1.getPageId)(documentName);
        let jwtPayload;
        try {
            jwtPayload = await this.tokenService.verifyJwt(token, jwt_payload_1.JwtType.COLLAB);
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid collab token');
        }
        const userId = jwtPayload.sub;
        const workspaceId = jwtPayload.workspaceId;
        const user = await this.userRepo.findById(userId, workspaceId);
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        if ((0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.UnauthorizedException();
        }
        const page = await this.pageRepo.findById(pageId);
        if (!page) {
            this.logger.debug(`Page not found: ${pageId}`);
            throw new common_1.NotFoundException('Page not found');
        }
        const userSpaceRoles = await this.spaceMemberRepo.getUserSpaceRoles(user.id, page.spaceId);
        const userSpaceRole = (0, utils_1.findHighestUserSpaceRole)(userSpaceRoles);
        if (!userSpaceRole) {
            this.logger.warn(`User not authorized to access page: ${pageId}`);
            throw new common_1.UnauthorizedException();
        }
        const { hasAnyRestriction, canAccess, canEdit } = await this.pagePermissionRepo.canUserEditPage(user.id, page.id);
        if (hasAnyRestriction) {
            if (!canAccess) {
                this.logger.warn(`User ${user.id} denied page-level access to page: ${pageId}`);
                throw new common_1.UnauthorizedException();
            }
            if (!canEdit) {
                data.connectionConfig.readOnly = true;
                this.logger.debug(`User ${user.id} granted readonly access to restricted page: ${pageId}`);
            }
        }
        else {
            if (userSpaceRole === permission_1.SpaceRole.READER) {
                data.connectionConfig.readOnly = true;
                this.logger.debug(`User granted readonly access to page: ${pageId}`);
            }
        }
        if (page.deletedAt) {
            data.connectionConfig.readOnly = true;
        }
        this.logger.debug(`Authenticated user ${user.id} on page ${pageId}`);
        return {
            user,
        };
    }
};
exports.AuthenticationExtension = AuthenticationExtension;
exports.AuthenticationExtension = AuthenticationExtension = AuthenticationExtension_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [token_service_1.TokenService,
        user_repo_1.UserRepo,
        page_repo_1.PageRepo,
        space_member_repo_1.SpaceMemberRepo,
        page_permission_repo_1.PagePermissionRepo])
], AuthenticationExtension);
//# sourceMappingURL=authentication.extension.js.map