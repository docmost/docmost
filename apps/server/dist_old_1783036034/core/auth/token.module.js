"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const environment_service_1 = require("../../integrations/environment/environment.service");
const token_service_1 = require("./services/token.service");
let TokenModule = class TokenModule {
};
exports.TokenModule = TokenModule;
exports.TokenModule = TokenModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                useFactory: async (environmentService) => {
                    return {
                        secret: environmentService.getAppSecret(),
                        signOptions: {
                            expiresIn: environmentService.getJwtTokenExpiresIn(),
                            issuer: 'Docmost',
                        },
                    };
                },
                inject: [environment_service_1.EnvironmentService],
            }),
        ],
        providers: [token_service_1.TokenService],
        exports: [token_service_1.TokenService],
    })
], TokenModule);
//# sourceMappingURL=token.module.js.map