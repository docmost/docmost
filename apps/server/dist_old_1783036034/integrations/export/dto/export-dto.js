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
exports.ExportSpaceDto = exports.ExportPageDto = exports.ExportFormat = void 0;
const class_validator_1 = require("class-validator");
var ExportFormat;
(function (ExportFormat) {
    ExportFormat["HTML"] = "html";
    ExportFormat["Markdown"] = "markdown";
})(ExportFormat || (exports.ExportFormat = ExportFormat = {}));
class ExportPageDto {
}
exports.ExportPageDto = ExportPageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ExportPageDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['html', 'markdown']),
    __metadata("design:type", String)
], ExportPageDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExportPageDto.prototype, "includeChildren", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExportPageDto.prototype, "includeAttachments", void 0);
class ExportSpaceDto {
}
exports.ExportSpaceDto = ExportSpaceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ExportSpaceDto.prototype, "spaceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['html', 'markdown']),
    __metadata("design:type", String)
], ExportSpaceDto.prototype, "format", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ExportSpaceDto.prototype, "includeAttachments", void 0);
//# sourceMappingURL=export-dto.js.map