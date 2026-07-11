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
exports.AuditActorInterceptor = void 0;
const common_1 = require("@nestjs/common");
const nestjs_cls_1 = require("nestjs-cls");
const audit_context_middleware_1 = require("../middlewares/audit-context.middleware");
let AuditActorInterceptor = class AuditActorInterceptor {
    constructor(cls) {
        this.cls = cls;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const user = request.user?.user;
        if (user?.id) {
            const auditContext = this.cls.get(audit_context_middleware_1.AUDIT_CONTEXT_KEY);
            if (auditContext) {
                auditContext.actorId = user.id;
                this.cls.set(audit_context_middleware_1.AUDIT_CONTEXT_KEY, auditContext);
            }
        }
        return next.handle();
    }
};
exports.AuditActorInterceptor = AuditActorInterceptor;
exports.AuditActorInterceptor = AuditActorInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_cls_1.ClsService])
], AuditActorInterceptor);
//# sourceMappingURL=audit-actor.interceptor.js.map