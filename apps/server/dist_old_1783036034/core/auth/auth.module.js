"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./services/auth.service");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const workspace_module_1 = require("../workspace/workspace.module");
const signup_service_1 = require("./services/signup.service");
const token_module_1 = require("./token.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [token_module_1.TokenModule, workspace_module_1.WorkspaceModule],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, signup_service_1.SignupService, jwt_strategy_1.JwtStrategy],
        exports: [signup_service_1.SignupService],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map