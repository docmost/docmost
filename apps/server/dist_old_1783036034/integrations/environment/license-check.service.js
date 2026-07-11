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
exports.LicenseCheckService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const environment_service_1 = require("./environment.service");
let LicenseCheckService = class LicenseCheckService {
    constructor(moduleRef, environmentService) {
        this.moduleRef = moduleRef;
        this.environmentService = environmentService;
    }
    isValidEELicense(licenseKey) {
        if (this.environmentService.isCloud()) {
            return true;
        }
        try {
            const LicenseModule = require('../../ee/licence/license.service');
            const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
                strict: false,
            });
            return licenseService.isValidEELicense(licenseKey);
        }
        catch {
            return false;
        }
    }
    hasFeature(licenseKey, feature, plan) {
        if (this.environmentService.isCloud()) {
            try {
                const { getFeaturesForCloudPlan } = require('../../ee/licence/feature-registry');
                return getFeaturesForCloudPlan(plan).has(feature);
            }
            catch {
                return false;
            }
        }
        try {
            const LicenseModule = require('../../ee/licence/license.service');
            const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
                strict: false,
            });
            return licenseService.hasFeature(licenseKey, feature);
        }
        catch {
            return false;
        }
    }
    getFeatures(licenseKey) {
        try {
            const LicenseModule = require('../../ee/licence/license.service');
            const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
                strict: false,
            });
            return licenseService.getFeatures(licenseKey);
        }
        catch {
            return [];
        }
    }
    resolveFeatures(licenseKey, plan) {
        if (this.environmentService.isCloud()) {
            try {
                const { getFeaturesForCloudPlan } = require('../../ee/licence/feature-registry');
                return [...getFeaturesForCloudPlan(plan)];
            }
            catch {
                return [];
            }
        }
        return this.getFeatures(licenseKey);
    }
    resolveTier(licenseKey, plan) {
        if (this.environmentService.isCloud()) {
            return plan ?? 'standard';
        }
        return this.getLicenseType(licenseKey) ?? 'free';
    }
    getLicenseType(licenseKey) {
        try {
            const LicenseModule = require('../../ee/licence/license.service');
            const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
                strict: false,
            });
            return licenseService.getLicenseType(licenseKey);
        }
        catch {
            return null;
        }
    }
};
exports.LicenseCheckService = LicenseCheckService;
exports.LicenseCheckService = LicenseCheckService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        environment_service_1.EnvironmentService])
], LicenseCheckService);
//# sourceMappingURL=license-check.service.js.map