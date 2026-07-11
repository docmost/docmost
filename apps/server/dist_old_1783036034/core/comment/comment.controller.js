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
exports.CommentController = void 0;
const common_1 = require("@nestjs/common");
const comment_service_1 = require("./comment.service");
const create_comment_dto_1 = require("./dto/create-comment.dto");
const update_comment_dto_1 = require("./dto/update-comment.dto");
const comments_input_1 = require("./dto/comments.input");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const space_ability_factory_1 = require("../casl/abilities/space-ability.factory");
const page_repo_1 = require("../../database/repos/page/page.repo");
const space_ability_type_1 = require("../casl/interfaces/space-ability.type");
const comment_repo_1 = require("../../database/repos/comment/comment.repo");
const page_access_service_1 = require("../page/page-access/page-access.service");
const audit_events_1 = require("../../common/events/audit-events");
const audit_service_1 = require("../../integrations/audit/audit.service");
const ws_service_1 = require("../../ws/ws.service");
let CommentController = class CommentController {
    constructor(commentService, commentRepo, pageRepo, spaceAbility, pageAccessService, wsService, auditService) {
        this.commentService = commentService;
        this.commentRepo = commentRepo;
        this.pageRepo = pageRepo;
        this.spaceAbility = spaceAbility;
        this.pageAccessService = pageAccessService;
        this.wsService = wsService;
        this.auditService = auditService;
    }
    async create(createCommentDto, user, workspace) {
        const page = await this.pageRepo.findById(createCommentDto.pageId);
        if (!page || page.deletedAt) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanComment(page, user, workspace.id);
        const comment = await this.commentService.create({
            page,
            workspaceId: workspace.id,
            user,
        }, createCommentDto);
        this.auditService.log({
            event: audit_events_1.AuditEvent.COMMENT_CREATED,
            resourceType: audit_events_1.AuditResource.COMMENT,
            resourceId: comment.id,
            spaceId: page.spaceId,
            metadata: {
                pageId: page.id,
            },
        });
        return comment;
    }
    async findPageComments(input, pagination, user) {
        const page = await this.pageRepo.findById(input.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return this.commentService.findByPageId(page.id, pagination);
    }
    async findOne(input, user) {
        const comment = await this.commentRepo.findById(input.commentId);
        if (!comment) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const page = await this.pageRepo.findById(comment.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
        return comment;
    }
    async update(dto, user, workspace) {
        const comment = await this.commentRepo.findById(dto.commentId, {
            includeCreator: true,
            includeResolvedBy: true,
        });
        if (!comment) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const page = await this.pageRepo.findById(comment.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanComment(page, user, workspace.id);
        return this.commentService.update(comment, dto, user);
    }
    async delete(input, user, workspace) {
        const comment = await this.commentRepo.findById(input.commentId);
        if (!comment) {
            throw new common_1.NotFoundException('Comment not found');
        }
        const page = await this.pageRepo.findById(comment.pageId);
        if (!page) {
            throw new common_1.NotFoundException('Page not found');
        }
        await this.pageAccessService.validateCanComment(page, user, workspace.id);
        const isOwner = comment.creatorId === user.id;
        if (isOwner) {
            await this.commentRepo.deleteComment(comment.id);
        }
        else {
            const ability = await this.spaceAbility.createForUser(user, comment.spaceId);
            if (ability.cannot(space_ability_type_1.SpaceCaslAction.Manage, space_ability_type_1.SpaceCaslSubject.Settings)) {
                throw new common_1.ForbiddenException('You can only delete your own comments');
            }
            await this.commentRepo.deleteComment(comment.id);
        }
        this.wsService.emitCommentEvent(comment.spaceId, comment.pageId, {
            operation: 'commentDeleted',
            pageId: comment.pageId,
            commentId: comment.id,
        });
        this.auditService.log({
            event: audit_events_1.AuditEvent.COMMENT_DELETED,
            resourceType: audit_events_1.AuditResource.COMMENT,
            resourceId: comment.id,
            spaceId: comment.spaceId,
            changes: {
                before: {
                    pageId: comment.pageId,
                    creatorId: comment.creatorId,
                },
            },
        });
    }
};
exports.CommentController = CommentController;
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_comment_dto_1.CreateCommentDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CommentController.prototype, "create", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('/'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [comments_input_1.PageIdDto,
        pagination_options_1.PaginationOptions, Object]),
    __metadata("design:returntype", Promise)
], CommentController.prototype, "findPageComments", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [comments_input_1.CommentIdDto, Object]),
    __metadata("design:returntype", Promise)
], CommentController.prototype, "findOne", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('update'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_comment_dto_1.UpdateCommentDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CommentController.prototype, "update", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [comments_input_1.CommentIdDto, Object, Object]),
    __metadata("design:returntype", Promise)
], CommentController.prototype, "delete", null);
exports.CommentController = CommentController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('comments'),
    __param(6, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [comment_service_1.CommentService,
        comment_repo_1.CommentRepo,
        page_repo_1.PageRepo,
        space_ability_factory_1.default,
        page_access_service_1.PageAccessService,
        ws_service_1.WsService, Object])
], CommentController);
//# sourceMappingURL=comment.controller.js.map