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
exports.ListLabelsDto = exports.LabelInfoDto = exports.FindPagesByLabelDto = exports.RemoveLabelDto = exports.AddLabelsDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const label_repo_1 = require("../../../database/repos/label/label.repo");
const page_dto_1 = require("../../page/dto/page.dto");
const utils_1 = require("../utils");
const SUPPORTED_LABEL_TYPES = [label_repo_1.LabelType.PAGE];
class AddLabelsDto extends page_dto_1.PageIdDto {
}
exports.AddLabelsDto = AddLabelsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(25),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.IsNotEmpty)({ each: true }),
    (0, class_transformer_1.Transform)(({ value }) => Array.isArray(value) ? value.map(utils_1.normalizeLabelName) : value),
    (0, class_validator_1.MaxLength)(100, { each: true }),
    (0, class_validator_1.Matches)(/^[\p{L}\p{N}_-][\p{L}\p{N}_~-]*$/u, {
        each: true,
        message: '标签名称只能包含字母、数字、连字符、下划线和波浪号，且不能以波浪号开头',
    }),
    __metadata("design:type", Array)
], AddLabelsDto.prototype, "names", void 0);
class RemoveLabelDto extends page_dto_1.PageIdDto {
}
exports.RemoveLabelDto = RemoveLabelDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RemoveLabelDto.prototype, "labelId", void 0);
class FindPagesByLabelDto {
}
exports.FindPagesByLabelDto = FindPagesByLabelDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], FindPagesByLabelDto.prototype, "labelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? (0, utils_1.normalizeLabelName)(value) : value),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], FindPagesByLabelDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], FindPagesByLabelDto.prototype, "spaceId", void 0);
class LabelInfoDto {
}
exports.LabelInfoDto = LabelInfoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string' ? (0, utils_1.normalizeLabelName)(value) : value),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], LabelInfoDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(SUPPORTED_LABEL_TYPES),
    __metadata("design:type", String)
], LabelInfoDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LabelInfoDto.prototype, "spaceId", void 0);
class ListLabelsDto {
}
exports.ListLabelsDto = ListLabelsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(SUPPORTED_LABEL_TYPES),
    __metadata("design:type", String)
], ListLabelsDto.prototype, "type", void 0);
//# sourceMappingURL=label.dto.js.map