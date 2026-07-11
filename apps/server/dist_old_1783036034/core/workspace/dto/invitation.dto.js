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
exports.RevokeInviteDto = exports.AcceptInviteDto = exports.InvitationIdDto = exports.InviteUserDto = void 0;
const class_validator_1 = require("class-validator");
const permission_1 = require("../../../common/helpers/types/permission");
const no_urls_validator_1 = require("../../../common/validators/no-urls.validator");
class InviteUserDto {
}
exports.InviteUserDto = InviteUserDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50, {
        message: 'you cannot invite more than 50 users at a time',
    }),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsEmail)({}, { each: true }),
    __metadata("design:type", Array)
], InviteUserDto.prototype, "emails", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(25, {
        message: 'you cannot add invited users to more than 25 groups at a time',
    }),
    (0, class_validator_1.ArrayMinSize)(0),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], InviteUserDto.prototype, "groupIds", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(permission_1.InviteUserRole),
    __metadata("design:type", String)
], InviteUserDto.prototype, "role", void 0);
class InvitationIdDto {
}
exports.InvitationIdDto = InvitationIdDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InvitationIdDto.prototype, "invitationId", void 0);
class AcceptInviteDto extends InvitationIdDto {
}
exports.AcceptInviteDto = AcceptInviteDto;
__decorate([
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(60),
    (0, class_validator_1.IsString)(),
    (0, no_urls_validator_1.NoUrls)(),
    __metadata("design:type", String)
], AcceptInviteDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AcceptInviteDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AcceptInviteDto.prototype, "token", void 0);
class RevokeInviteDto extends InvitationIdDto {
}
exports.RevokeInviteDto = RevokeInviteDto;
//# sourceMappingURL=invitation.dto.js.map