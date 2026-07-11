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
exports.TransclusionController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../../common/guards/jwt-auth.guard");
const auth_user_decorator_1 = require("../../../common/decorators/auth-user.decorator");
const transclusion_service_1 = require("./transclusion.service");
const lookup_dto_1 = require("./dto/lookup.dto");
const references_dto_1 = require("./dto/references.dto");
const unsync_reference_dto_1 = require("./dto/unsync-reference.dto");
let TransclusionController = class TransclusionController {
    constructor(transclusionService) {
        this.transclusionService = transclusionService;
    }
    async lookup(dto, user) {
        return this.transclusionService.lookup(dto.references, user.id, user.workspaceId);
    }
    async references(dto, user) {
        return this.transclusionService.listReferences({
            sourcePageId: dto.sourcePageId,
            transclusionId: dto.transclusionId,
            viewerUserId: user.id,
            workspaceId: user.workspaceId,
        });
    }
    async unsyncReference(dto, user) {
        return this.transclusionService.unsyncReference(dto.referencePageId, dto.sourcePageId, dto.transclusionId, user);
    }
};
exports.TransclusionController = TransclusionController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('lookup'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [lookup_dto_1.LookupDto, Object]),
    __metadata("design:returntype", Promise)
], TransclusionController.prototype, "lookup", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('references'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [references_dto_1.ReferencesDto, Object]),
    __metadata("design:returntype", Promise)
], TransclusionController.prototype, "references", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('unsync-reference'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [unsync_reference_dto_1.UnsyncReferenceDto, Object]),
    __metadata("design:returntype", Promise)
], TransclusionController.prototype, "unsyncReference", null);
exports.TransclusionController = TransclusionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('pages/transclusion'),
    __metadata("design:paramtypes", [transclusion_service_1.TransclusionService])
], TransclusionController);
//# sourceMappingURL=transclusion.controller.js.map