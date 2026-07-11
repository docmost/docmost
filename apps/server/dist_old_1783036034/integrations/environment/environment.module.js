"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentModule = void 0;
const common_1 = require("@nestjs/common");
const environment_service_1 = require("./environment.service");
const config_1 = require("@nestjs/config");
const environment_validation_1 = require("./environment.validation");
const helpers_1 = require("../../common/helpers");
const domain_service_1 = require("./domain.service");
const license_check_service_1 = require("./license-check.service");
let EnvironmentModule = class EnvironmentModule {
};
exports.EnvironmentModule = EnvironmentModule;
exports.EnvironmentModule = EnvironmentModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                expandVariables: true,
                envFilePath: helpers_1.envPath,
                validate: environment_validation_1.validate,
            }),
        ],
        providers: [environment_service_1.EnvironmentService, domain_service_1.DomainService, license_check_service_1.LicenseCheckService],
        exports: [environment_service_1.EnvironmentService, domain_service_1.DomainService, license_check_service_1.LicenseCheckService],
    })
], EnvironmentModule);
//# sourceMappingURL=environment.module.js.map