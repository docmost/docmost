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
exports.UpdatePageDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_page_dto_1 = require("./create-page.dto");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class UpdatePageDto extends (0, mapped_types_1.PartialType)(create_page_dto_1.CreatePageDto) {
}
exports.UpdatePageDto = UpdatePageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePageDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdatePageDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.content !== undefined),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase()),
    (0, class_validator_1.IsIn)(['append', 'prepend', 'replace']),
    __metadata("design:type", String)
], UpdatePageDto.prototype, "operation", void 0);
__decorate([
    (0, class_validator_1.ValidateIf)((o) => o.content !== undefined),
    (0, class_transformer_1.Transform)(({ value }) => value?.toLowerCase() ?? 'json'),
    (0, class_validator_1.IsIn)(['json', 'markdown', 'html']),
    __metadata("design:type", String)
], UpdatePageDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdatePageDto.prototype, "metadata", void 0);
//# sourceMappingURL=update-page.dto.js.map