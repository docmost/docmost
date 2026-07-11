import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';
export declare class LicenseCheckService {
    private moduleRef;
    private environmentService;
    constructor(moduleRef: ModuleRef, environmentService: EnvironmentService);
    isValidEELicense(licenseKey: string): boolean;
    hasFeature(licenseKey: string, feature: string, plan?: string): boolean;
    getFeatures(licenseKey: string): string[];
    resolveFeatures(licenseKey: string, plan: string): string[];
    resolveTier(licenseKey: string, plan: string): string;
    private getLicenseType;
}
