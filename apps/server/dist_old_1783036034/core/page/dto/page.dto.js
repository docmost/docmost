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
exports.DeletePageDto = exports.PageInfoDto = exports.PageHistoryIdDto = exports.SpaceIdDto = exports.PageIdDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class PageIdDto {
}
exports.PageIdDto = PageIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PageIdDto.prototype, "pageId", void 0);
class SpaceIdDto {
}
exports.SpaceIdDto = SpaceIdDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SpaceIdDto.prototype, "spaceId", void 0);
class PageHistoryIdDto {
}
exports.PageHistoryIdDto = PageHistoryIdDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PageHistoryIdDto.prototype, "historyId", void 0);
class PageInfoDto extends PageIdDto {
}
exports.PageInfoDto = PageInfoDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PageInfoDto.prototype, "includeSpace", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PageInfoDto.prototype, "includeContent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase()),
    (0, class_validator_1.IsIn)(['json', 'markdown', 'html']),
    __metadata("design:type", String)
], PageInfoDto.prototype, "format", void 0);
class DeletePageDto extends PageIdDto {
}
exports.DeletePageDto = DeletePageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DeletePageDto.prototype, "permanentlyDelete", void 0);
//# sourceMappingURL=page.dto.js.map