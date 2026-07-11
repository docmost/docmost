"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("./notification.service");
const notification_controller_1 = require("./notification.controller");
const notification_processor_1 = require("./notification.processor");
const comment_notification_1 = require("./services/comment.notification");
const page_notification_1 = require("./services/page.notification");
const verification_notification_1 = require("./services/verification.notification");
const page_update_email_rate_limiter_1 = require("./services/page-update-email-rate-limiter");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        imports: [],
        controllers: [notification_controller_1.NotificationController],
        providers: [
            notification_service_1.NotificationService,
            notification_processor_1.NotificationProcessor,
            comment_notification_1.CommentNotificationService,
            page_notification_1.PageNotificationService,
            verification_notification_1.VerificationNotificationService,
            page_update_email_rate_limiter_1.PageUpdateEmailRateLimiter,
        ],
        exports: [notification_service_1.NotificationService],
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map