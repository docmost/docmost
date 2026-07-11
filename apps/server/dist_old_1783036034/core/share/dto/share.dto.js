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
exports.SharePageIdDto = exports.ShareInfoDto = exports.SpaceIdDto = exports.ShareIdDto = exports.UpdateShareDto = exports.CreateShareDto = void 0;
const class_validator_1 = require("class-validator");
class CreateShareDto {
}
exports.CreateShareDto = CreateShareDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateShareDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateShareDto.prototype, "includeSubPages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateShareDto.prototype, "searchIndexing", void 0);
class UpdateShareDto extends CreateShareDto {
}
exports.UpdateShareDto = UpdateShareDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateShareDto.prototype, "shareId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateShareDto.prototype, "pageId", void 0);
class ShareIdDto {
}
exports.ShareIdDto = ShareIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ShareIdDto.prototype, "shareId", void 0);
class SpaceIdDto {
}
exports.SpaceIdDto = SpaceIdDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SpaceIdDto.prototype, "spaceId", void 0);
class ShareInfoDto {
}
exports.ShareInfoDto = ShareInfoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ShareInfoDto.prototype, "shareId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ShareInfoDto.prototype, "pageId", void 0);
class SharePageIdDto {
}
exports.SharePageIdDto = SharePageIdDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SharePageIdDto.prototype, "pageId", void 0);
//# sourceMappingURL=share.dto.js.map