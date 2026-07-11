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
var SearchController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const search_service_1 = require("./search.service");
const search_dto_1 = require("./dto/search.dto");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const environment_service_1 = require("../../integrations/environment/environment.service");
const core_1 = require("@nestjs/core");
let SearchController = SearchController_1 = class SearchController {
    constructor(searchService, spaceAbility, environmentService, moduleRef) {
        this.searchService = searchService;
        this.spaceAbility = spaceAbility;
        this.environmentService = environmentService;
        this.moduleRef = moduleRef;
        this.logger = new common_1.Logger(SearchController_1.name);
    }
    async pageSearch(searchDto, user, workspace) {
        delete searchDto.shareId;
        if (searchDto.spaceId) {
            const ability = await this.spaceAbility.createForUser(user, searchDto.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
                throw new common_1.ForbiddenException();
            }
        }
        if (this.environmentService.getSearchDriver() === 'typesense') {
            return this.searchTypesense(searchDto, {
                userId: user.id,
                workspaceId: workspace.id,
            });
        }
        return this.searchService.searchPage(searchDto, {
            userId: user.id,
            workspaceId: workspace.id,
        });
    }
    async searchSuggestions(dto, user, workspace) {
        return this.searchService.searchSuggestions(dto, user.id, workspace.id);
    }
    async searchShare(searchDto, workspace) {
        delete searchDto.spaceId;
        if (!searchDto.shareId) {
            throw new common_1.BadRequestException('shareId is required');
        }
        if (this.environmentService.getSearchDriver() === 'typesense') {
            return this.searchTypesense(searchDto, {
                workspaceId: workspace.id,
            });
        }
        return this.searchService.searchPage(searchDto, {
            workspaceId: workspace.id,
        });
    }
    async searchTypesense(searchParams, opts) {
        const { userId, workspaceId } = opts;
        let TypesenseModule;
        try {
            TypesenseModule = require('./../../ee/typesense/services/page-search.service');
            const PageSearchService = this.moduleRef.get(TypesenseModule.PageSearchService, {
                strict: false,
            });
            return PageSearchService.searchPage(searchParams, {
                userId: userId,
                workspaceId,
            });
        }
        catch (err) {
            this.logger.debug('Typesense module requested but enterprise module not bundled in this build');
        }
        throw new common_1.BadRequestException('Enterprise Typesense search module missing');
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_dto_1.SearchDTO, Object, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "pageSearch", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('suggest'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_dto_1.SearchSuggestionDTO, Object, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "searchSuggestions", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('share-search'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [search_dto_1.SearchShareDTO, Object]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "searchShare", null);
exports.SearchController = SearchController = SearchController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('search'),
    __metadata("design:paramtypes", [search_service_1.SearchService,
        space_ability_factory_1.default,
        environment_service_1.EnvironmentService,
        core_1.ModuleRef])
], SearchController);
//# sourceMappingURL=search.controller.js.map