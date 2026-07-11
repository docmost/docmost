"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransclusionModule = void 0;
const common_1 = require("@nestjs/common");
const transclusion_controller_1 = require("./transclusion.controller");
const transclusion_service_1 = require("./transclusion.service");
let TransclusionModule = class TransclusionModule {
};
exports.TransclusionModule = TransclusionModule;
exports.TransclusionModule = TransclusionModule = __decorate([
    (0, common_1.Module)({
        controllers: [transclusion_controller_1.TransclusionController],
        providers: [transclusion_service_1.TransclusionService],
        exports: [transclusion_service_1.TransclusionService],
    })
], TransclusionModule);
//# sourceMappingURL=transclusion.module.js.map