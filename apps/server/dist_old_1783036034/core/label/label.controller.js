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
exports.LabelController = void 0;
const common_1 = require("@nestjs/common");
const label_service_1 = require("./label.service");
const label_dto_1 = require("./dto/label.dto");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const label_repo_1 = require("../../database/repos/label/label.repo");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const cursor_pagination_1 = require("../../database/pagination/cursor-pagination");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
let LabelController = class LabelController {
    constructor(labelService, labelRepo, spaceAbility) {
        this.labelService = labelService;
        this.labelRepo = labelRepo;
        this.spaceAbility = spaceAbility;
    }
    async getLabels(dto, pagination, user, workspace) {
        return this.labelService.getLabels(workspace.id, user.id, dto.type, pagination);
    }
    async findPagesByLabel(dto, pagination, user, workspace) {
        if (dto.spaceId) {
            await this.assertCanReadSpace(user, dto.spaceId);
        }
        let labelId = dto.labelId;
        if (!labelId) {
            if (!dto.name) {
                throw new common_1.BadRequestException('labelId or name is required');
            }
            const label = await this.labelRepo.findByNameAndWorkspace(dto.name, workspace.id, label_repo_1.LabelType.PAGE);
            if (!label) {
                return (0, cursor_pagination_1.emptyCursorPaginationResult)(pagination.limit);
            }
            labelId = label.id;
        }
        else {
            const label = await this.labelRepo.findById(labelId);
            if (!label) {
                throw new common_1.NotFoundException('Label not found');
            }
        }
        return this.labelService.findPagesByLabel(labelId, user.id, {
            spaceId: dto.spaceId,
            query: pagination.query,
            pagination,
        });
    }
    async assertCanReadSpace(user, spaceId) {
        const ability = await this.spaceAbility.createForUser(user, spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
    }
};
exports.LabelController = LabelController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [label_dto_1.ListLabelsDto,
        pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "getLabels", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('pages'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __param(3, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [label_dto_1.FindPagesByLabelDto,
        pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], LabelController.prototype, "findPagesByLabel", null);
exports.LabelController = LabelController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('labels'),
    __metadata("design:paramtypes", [label_service_1.LabelService,
        label_repo_1.LabelRepo,
        space_ability_factory_1.default])
], LabelController);
//# sourceMappingURL=label.controller.js.map