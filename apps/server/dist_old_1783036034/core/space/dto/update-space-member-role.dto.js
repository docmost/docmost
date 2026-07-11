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
exports.UpdateSpaceMemberRoleDto = void 0;
const class_validator_1 = require("class-validator");
const space_id_dto_1 = require("./space-id.dto");
const permission_1 = require("../../../common/helpers/types/permission");
class UpdateSpaceMemberRoleDto extends space_id_dto_1.SpaceIdDto {
}
exports.UpdateSpaceMemberRoleDto = UpdateSpaceMemberRoleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateSpaceMemberRoleDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateSpaceMemberRoleDto.prototype, "groupId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(permission_1.SpaceRole),
    __metadata("design:type", String)
], UpdateSpaceMemberRoleDto.prototype, "role", void 0);
//# sourceMappingURL=update-space-member-role.dto.js.map