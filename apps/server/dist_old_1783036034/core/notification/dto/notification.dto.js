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
exports.ListNotificationsDto = exports.MarkNotificationsReadDto = exports.NotificationIdDto = void 0;
const class_validator_1 = require("class-validator");
const pagination_options_1 = require("../../../database/pagination/pagination-options");
class NotificationIdDto {
}
exports.NotificationIdDto = NotificationIdDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], NotificationIdDto.prototype, "notificationId", void 0);
class MarkNotificationsReadDto {
}
exports.MarkNotificationsReadDto = MarkNotificationsReadDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], MarkNotificationsReadDto.prototype, "notificationIds", void 0);
class ListNotificationsDto extends pagination_options_1.PaginationOptions {
    constructor() {
        super(...arguments);
        this.type = 'all';
    }
}
exports.ListNotificationsDto = ListNotificationsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['direct', 'updates', 'all']),
    __metadata("design:type", String)
], ListNotificationsDto.prototype, "type", void 0);
//# sourceMappingURL=notification.dto.js.map