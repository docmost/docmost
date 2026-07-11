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
exports.AddGroupUserDto = void 0;
const class_validator_1 = require("class-validator");
const group_id_dto_1 = require("./group-id.dto");
class AddGroupUserDto extends group_id_dto_1.GroupIdDto {
}
exports.AddGroupUserDto = AddGroupUserDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50, {
        message: 'you cannot add more than 50 users at a time',
    }),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], AddGroupUserDto.prototype, "userIds", void 0);
//# sourceMappingURL=add-group-user.dto.js.map