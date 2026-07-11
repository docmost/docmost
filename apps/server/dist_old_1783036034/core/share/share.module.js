"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareModule = void 0;
const common_1 = require("@nestjs/common");
const share_controller_1 = require("./share.controller");
const share_service_1 = require("./share.service");
const token_module_1 = require("../auth/token.module");
const share_seo_controller_1 = require("./share-seo.controller");
const transclusion_module_1 = require("../page/transclusion/transclusion.module");
let ShareModule = class ShareModule {
};
exports.ShareModule = ShareModule;
exports.ShareModule = ShareModule = __decorate([
    (0, common_1.Module)({
        imports: [token_module_1.TokenModule, transclusion_module_1.TransclusionModule],
        controllers: [share_controller_1.ShareController, share_seo_controller_1.ShareSeoController],
        providers: [share_service_1.ShareService],
        exports: [share_service_1.ShareService],
    })
], ShareModule);
//# sourceMappingURL=share.module.js.map