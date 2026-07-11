"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsModule = void 0;
const common_1 = require("@nestjs/common");
const ws_gateway_1 = require("./ws.gateway");
const ws_service_1 = require("./ws.service");
const ws_tree_service_1 = require("./ws-tree.service");
const token_module_1 = require("../core/auth/token.module");
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [token_module_1.TokenModule],
        providers: [ws_gateway_1.WsGateway, ws_service_1.WsService, ws_tree_service_1.WsTreeService],
        exports: [ws_gateway_1.WsGateway, ws_service_1.WsService, ws_tree_service_1.WsTreeService],
    })
], WsModule);
//# sourceMappingURL=ws.module.js.map