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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const public_decorator_1 = require("../decorators/public.decorator");
const core_1 = require("@nestjs/core");
const environment_service_1 = require("../../integrations/environment/environment.service");
const date_fns_1 = require("date-fns");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector, environmentService) {
        super();
        this.reflector = reflector;
        this.environmentService = environmentService;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        return super.canActivate(context);
    }
    handleRequest(err, user, info, ctx) {
        if (err || !user) {
            throw err || new common_1.UnauthorizedException();
        }
        this.setJoinedWorkspacesCookie(user, ctx);
        return user;
    }
    setJoinedWorkspacesCookie(user, ctx) {
        if (this.environmentService.isCloud()) {
            const req = ctx.switchToHttp().getRequest();
            const res = ctx.switchToHttp().getResponse();
            const workspaceId = user?.workspace?.id;
            let workspaceIds = [];
            try {
                workspaceIds = req.cookies.joinedWorkspaces
                    ? JSON.parse(req.cookies.joinedWorkspaces)
                    : [];
            }
            catch (err) {
            }
            if (!workspaceIds.includes(workspaceId)) {
                workspaceIds.push(workspaceId);
            }
            res.setCookie('joinedWorkspaces', JSON.stringify(workspaceIds), {
                httpOnly: false,
                domain: '.' + this.environmentService.getSubdomainHost(),
                path: '/',
                expires: (0, date_fns_1.addDays)(new Date(), 365),
                secure: this.environmentService.isHttps(),
            });
        }
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        environment_service_1.EnvironmentService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map