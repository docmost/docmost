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
exports.FileTaskController = void 0;
const common_1 = require("@nestjs/common");
const space_ability_factory_1 = require("../../core/casl/abilities/space-ability.factory");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const space_ability_type_1 = require("../../core/casl/interfaces/space-ability.type");
const workspace_ability_type_1 = require("../../core/casl/interfaces/workspace-ability.type");
const workspace_ability_factory_1 = require("../../core/casl/abilities/workspace-ability.factory");
const auth_workspace_decorator_1 = require("../../common/decorators/auth-workspace.decorator");
const nestjs_kysely_1 = require("nestjs-kysely");
const auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
const file_task_dto_1 = require("./dto/file-task-dto");
const space_member_repo_1 = require("../../database/repos/space/space-member.repo");
const pagination_options_1 = require("../../database/pagination/pagination-options");
const cursor_pagination_1 = require("../../database/pagination/cursor-pagination");
let FileTaskController = class FileTaskController {
    constructor(spaceAbility, workspaceAbility, spaceMemberRepo, db) {
        this.spaceAbility = spaceAbility;
        this.workspaceAbility = workspaceAbility;
        this.spaceMemberRepo = spaceMemberRepo;
        this.db = db;
    }
    async getFileTasks(pagination, user, workspace) {
        const ability = this.workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(workspace_ability_type_1.WorkspaceCaslAction.Manage, workspace_ability_type_1.WorkspaceCaslSubject.Settings)) {
            throw new common_1.ForbiddenException();
        }
        const query = this.db
            .selectFrom('fileTasks')
            .selectAll()
            .where('spaceId', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(user.id));
        return (0, cursor_pagination_1.executeWithCursorPagination)(query, {
            perPage: pagination.limit,
            cursor: pagination.cursor,
            beforeCursor: pagination.beforeCursor,
            fields: [{ expression: 'id', direction: 'desc' }],
            parseCursor: (cursor) => ({ id: cursor.id }),
        });
    }
    async getFileTask(dto, user) {
        const fileTask = await this.db
            .selectFrom('fileTasks')
            .selectAll()
            .where('id', '=', dto.fileTaskId)
            .executeTakeFirst();
        if (!fileTask || !fileTask.spaceId) {
            throw new common_1.NotFoundException('File task not found');
        }
        const ability = await this.spaceAbility.createForUser(user, fileTask.spaceId);
        if (ability.cannot(space_ability_type_1.SpaceCaslAction.Read, space_ability_type_1.SpaceCaslSubject.Page)) {
            throw new common_1.ForbiddenException();
        }
        return fileTask;
    }
};
exports.FileTaskController = FileTaskController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __param(2, (0, auth_workspace_decorator_1.AuthWorkspace)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_options_1.PaginationOptions, Object, Object]),
    __metadata("design:returntype", Promise)
], FileTaskController.prototype, "getFileTasks", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('info'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, auth_user_decorator_1.AuthUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [file_task_dto_1.FileTaskIdDto, Object]),
    __metadata("design:returntype", Promise)
], FileTaskController.prototype, "getFileTask", null);
exports.FileTaskController = FileTaskController = __decorate([
    (0, common_1.Controller)('file-tasks'),
    __param(3, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [space_ability_factory_1.default,
        workspace_ability_factory_1.default,
        space_member_repo_1.SpaceMemberRepo, Object])
], FileTaskController);
//# sourceMappingURL=file-task.controller.js.map