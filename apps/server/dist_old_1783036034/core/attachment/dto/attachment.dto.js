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
exports.RemoveIconDto = exports.AttachmentInfoDto = void 0;
const class_validator_1 = require("class-validator");
const attachment_constants_1 = require("../attachment.constants");
class AttachmentInfoDto {
}
exports.AttachmentInfoDto = AttachmentInfoDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttachmentInfoDto.prototype, "attachmentId", void 0);
class RemoveIconDto {
}
exports.RemoveIconDto = RemoveIconDto;
__decorate([
    (0, class_validator_1.IsEnum)(attachment_constants_1.AttachmentType),
    (0, class_validator_1.IsIn)([
        attachment_constants_1.AttachmentType.Avatar,
        attachment_constants_1.AttachmentType.SpaceIcon,
        attachment_constants_1.AttachmentType.WorkspaceIcon,
    ]),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RemoveIconDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RemoveIconDto.prototype, "spaceId", void 0);
//# sourceMappingURL=attachment.dto.js.map