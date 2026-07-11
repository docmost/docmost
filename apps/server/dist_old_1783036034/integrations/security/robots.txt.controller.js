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
exports.RobotsTxtController = void 0;
const common_1 = require("@nestjs/common");
const skip_transform_decorator_1 = require("../../common/decorators/skip-transform.decorator");
let RobotsTxtController = class RobotsTxtController {
    async robotsTxt() {
        return 'User-Agent: *\nDisallow: /login\nDisallow: /forgot-password';
    }
};
exports.RobotsTxtController = RobotsTxtController;
__decorate([
    (0, skip_transform_decorator_1.SkipTransform)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RobotsTxtController.prototype, "robotsTxt", null);
exports.RobotsTxtController = RobotsTxtController = __decorate([
    (0, common_1.Controller)('robots.txt')
], RobotsTxtController);
//# sourceMappingURL=robots.txt.controller.js.map