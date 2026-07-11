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
exports.CreateCommentDto = exports.yjsSelectionSchema = void 0;
const class_validator_1 = require("class-validator");
const zod_1 = require("zod");
const yjsIdSchema = zod_1.z.object({
    client: zod_1.z.number().int().nonnegative(),
    clock: zod_1.z.number().int().nonnegative(),
});
const yjsRelativePositionSchema = zod_1.z.object({
    type: yjsIdSchema,
    tname: zod_1.z.string().nullable(),
    item: yjsIdSchema.nullable(),
    assoc: zod_1.z.number().int(),
});
exports.yjsSelectionSchema = zod_1.z.object({
    anchor: yjsRelativePositionSchema,
    head: yjsRelativePositionSchema,
});
class CreateCommentDto {
}
exports.CreateCommentDto = CreateCommentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCommentDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsJSON)(),
    __metadata("design:type", Object)
], CreateCommentDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCommentDto.prototype, "selection", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['inline', 'page']),
    __metadata("design:type", String)
], CreateCommentDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCommentDto.prototype, "parentCommentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateCommentDto.prototype, "yjsSelection", void 0);
//# sourceMappingURL=create-comment.dto.js.map