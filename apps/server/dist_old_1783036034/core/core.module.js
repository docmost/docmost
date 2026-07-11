"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const user_module_1 = require("./user/user.module");
const auth_module_1 = require("./auth/auth.module");
const workspace_module_1 = require("./workspace/workspace.module");
const page_module_1 = require("./page/page.module");
const attachment_module_1 = require("./attachment/attachment.module");
const comment_module_1 = require("./comment/comment.module");
const search_module_1 = require("./search/search.module");
const space_module_1 = require("./space/space.module");
const group_module_1 = require("./group/group.module");
const casl_module_1 = require("./casl/casl.module");
const page_access_module_1 = require("./page/page-access/page-access.module");
const domain_middleware_1 = require("../common/middlewares/domain.middleware");
const audit_context_middleware_1 = require("../common/middlewares/audit-context.middleware");
const share_module_1 = require("./share/share.module");
const label_module_1 = require("./label/label.module");
const notification_module_1 = require("./notification/notification.module");
const watcher_module_1 = require("./watcher/watcher.module");
const favorite_module_1 = require("./favorite/favorite.module");
const session_module_1 = require("./session/session.module");
let CoreModule = class CoreModule {
    configure(consumer) {
        const excludedRoutes = [
            { path: 'auth/setup', method: common_1.RequestMethod.POST },
            { path: 'health', method: common_1.RequestMethod.GET },
            { path: 'health/live', method: common_1.RequestMethod.GET },
            { path: 'billing/stripe/webhook', method: common_1.RequestMethod.POST },
        ];
        consumer
            .apply(domain_middleware_1.DomainMiddleware)
            .exclude(...excludedRoutes)
            .forRoutes('*');
        consumer
            .apply(audit_context_middleware_1.AuditContextMiddleware)
            .exclude(...excludedRoutes)
            .forRoutes('*');
    }
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Module)({
        imports: [
            user_module_1.UserModule,
            auth_module_1.AuthModule,
            workspace_module_1.WorkspaceModule,
            page_module_1.PageModule,
            attachment_module_1.AttachmentModule,
            comment_module_1.CommentModule,
            favorite_module_1.FavoriteModule,
            search_module_1.SearchModule,
            space_module_1.SpaceModule,
            group_module_1.GroupModule,
            casl_module_1.CaslModule,
            page_access_module_1.PageAccessModule,
            share_module_1.ShareModule,
            label_module_1.LabelModule,
            notification_module_1.NotificationModule,
            watcher_module_1.WatcherModule,
            session_module_1.SessionModule,
        ],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map