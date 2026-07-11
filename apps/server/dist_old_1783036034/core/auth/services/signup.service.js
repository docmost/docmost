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
exports.SignupService = void 0;
const common_1 = require("@nestjs/common");
const workspace_service_1 = require("../../workspace/services/workspace.service");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const utils_1 = require("../../../database/utils");
const nestjs_kysely_1 = require("nestjs-kysely");
const group_user_repo_1 = require("../../../database/repos/group/group-user.repo");
const permission_1 = require("../../../common/helpers/types/permission");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let SignupService = class SignupService {
    constructor(userRepo, workspaceService, groupUserRepo, db, auditService) {
        this.userRepo = userRepo;
        this.workspaceService = workspaceService;
        this.groupUserRepo = groupUserRepo;
        this.db = db;
        this.auditService = auditService;
    }
    async signup(createUserDto, workspaceId, trx) {
        const userCheck = await this.userRepo.findByEmail(createUserDto.email, workspaceId);
        if (userCheck) {
            throw new common_1.BadRequestException('An account with this email already exists in this workspace');
        }
        const user = await (0, utils_1.executeTx)(this.db, async (trx) => {
            const user = await this.userRepo.insertUser({
                ...createUserDto,
                workspaceId: workspaceId,
            }, trx);
            await this.workspaceService.addUserToWorkspace(user.id, workspaceId, undefined, trx);
            await this.groupUserRepo.addUserToDefaultGroup(user.id, workspaceId, trx);
            return user;
        }, trx);
        this.auditService.log({
            event: audit_events_1.AuditEvent.USER_CREATED,
            resourceType: audit_events_1.AuditResource.USER,
            resourceId: user.id,
            changes: {
                after: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
            metadata: {
                source: 'signup',
            },
        });
        return user;
    }
    async initialSetup(createAdminUserDto, trx) {
        let user, workspace = null;
        await (0, utils_1.executeTx)(this.db, async (trx) => {
            user = await this.userRepo.insertUser({
                name: createAdminUserDto.name,
                email: createAdminUserDto.email,
                password: createAdminUserDto.password,
                role: permission_1.UserRole.OWNER,
                emailVerifiedAt: new Date(),
            }, trx);
            const workspaceData = {
                name: createAdminUserDto.workspaceName || 'My workspace',
                hostname: createAdminUserDto.hostname,
            };
            workspace = await this.workspaceService.create(user, workspaceData, trx);
            user.workspaceId = workspace.id;
            return user;
        }, trx);
        return { user, workspace };
    }
};
exports.SignupService = SignupService;
exports.SignupService = SignupService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, nestjs_kysely_1.InjectKysely)()),
    __param(4, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [user_repo_1.UserRepo,
        workspace_service_1.WorkspaceService,
        group_user_repo_1.GroupUserRepo, Object, Object])
], SignupService);
//# sourceMappingURL=signup.service.js.map