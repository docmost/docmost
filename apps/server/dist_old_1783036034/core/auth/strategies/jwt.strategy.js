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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const jwt_payload_1 = require("../dto/jwt-payload");
const workspace_repo_1 = require("../../../database/repos/workspace/workspace.repo");
const user_repo_1 = require("../../../database/repos/user/user.repo");
const user_session_repo_1 = require("../../../database/repos/session/user-session.repo");
const session_activity_service_1 = require("../../session/session-activity.service");
const helpers_1 = require("../../../common/helpers");
const core_1 = require("@nestjs/core");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'jwt') {
    constructor(userRepo, workspaceRepo, userSessionRepo, sessionActivityService, environmentService, moduleRef) {
        super({
            jwtFromRequest: (req) => {
                return req.cookies?.authToken || (0, helpers_1.extractBearerTokenFromHeader)(req);
            },
            ignoreExpiration: false,
            secretOrKey: environmentService.getAppSecret(),
            passReqToCallback: true,
        });
        this.userRepo = userRepo;
        this.workspaceRepo = workspaceRepo;
        this.userSessionRepo = userSessionRepo;
        this.sessionActivityService = sessionActivityService;
        this.environmentService = environmentService;
        this.moduleRef = moduleRef;
        this.logger = new common_1.Logger('JwtStrategy');
    }
    async validate(req, payload) {
        if (!payload.workspaceId) {
            throw new common_1.UnauthorizedException();
        }
        if (req.raw.workspaceId && req.raw.workspaceId !== payload.workspaceId) {
            throw new common_1.UnauthorizedException('Workspace does not match');
        }
        if (payload.type === jwt_payload_1.JwtType.API_KEY) {
            return this.validateApiKey(req, payload);
        }
        if (payload.type !== jwt_payload_1.JwtType.ACCESS) {
            throw new common_1.UnauthorizedException();
        }
        const workspace = await this.workspaceRepo.findById(payload.workspaceId);
        if (!workspace) {
            throw new common_1.UnauthorizedException();
        }
        const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
        if (!user || (0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.UnauthorizedException();
        }
        if (payload.sessionId) {
            const sessionId = payload.sessionId;
            const session = await this.userSessionRepo.findActiveById(sessionId);
            if (!session || session.userId !== payload.sub || session.workspaceId !== payload.workspaceId) {
                throw new common_1.UnauthorizedException();
            }
            req.raw.sessionId = sessionId;
            this.sessionActivityService.trackActivity(sessionId, payload.sub, payload.workspaceId);
        }
        return { user, workspace };
    }
    async validateApiKey(req, payload) {
        let ApiKeyModule;
        let isApiKeyModuleReady = false;
        try {
            ApiKeyModule = require('./../../../ee/api-key/api-key.service');
            isApiKeyModuleReady = true;
        }
        catch (err) {
            this.logger.debug('API Key module requested but enterprise module not bundled in this build');
            isApiKeyModuleReady = false;
        }
        if (isApiKeyModuleReady) {
            const ApiKeyService = this.moduleRef.get(ApiKeyModule.ApiKeyService, {
                strict: false,
            });
            return ApiKeyService.validateApiKey(payload);
        }
        throw new common_1.UnauthorizedException('Enterprise API Key module missing');
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_repo_1.UserRepo,
        workspace_repo_1.WorkspaceRepo,
        user_session_repo_1.UserSessionRepo,
        session_activity_service_1.SessionActivityService,
        environment_service_1.EnvironmentService,
        core_1.ModuleRef])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map