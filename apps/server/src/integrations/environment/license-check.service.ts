import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service.js';
import { requireEe } from '../../common/helpers/ee-loader.js';

@Injectable()
export class LicenseCheckService {
  constructor(
    private moduleRef: ModuleRef,
    private environmentService: EnvironmentService,
  ) {}

  isValidEELicense(licenseKey: string): boolean {
    if (this.environmentService.isCloud()) {
      return true;
    }

    try {
      const LicenseModule = requireEe('licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.isValidEELicense(licenseKey);
    } catch {
      return false;
    }
  }

  hasFeature(licenseKey: string, feature: string, plan?: string): boolean {
    if (this.environmentService.isCloud()) {
      try {
        const { getFeaturesForCloudPlan } = requireEe('licence/feature-registry');
        return getFeaturesForCloudPlan(plan).has(feature);
      } catch {
        return false;
      }
    }

    try {
      const LicenseModule = requireEe('licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.hasFeature(licenseKey, feature);
    } catch {
      return false;
    }
  }

  getFeatures(licenseKey: string): string[] {
    try {
      const LicenseModule = requireEe('licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.getFeatures(licenseKey);
    } catch {
      return [];
    }
  }

  resolveFeatures(licenseKey: string, plan: string): string[] {
    if (this.environmentService.isCloud()) {
      try {
        const { getFeaturesForCloudPlan } = requireEe('licence/feature-registry');
        return [...getFeaturesForCloudPlan(plan)];
      } catch {
        return [];
      }
    }

    return this.getFeatures(licenseKey);
  }

  resolveTier(licenseKey: string, plan: string): string {
    if (this.environmentService.isCloud()) {
      return plan ?? 'standard';
    }

    return this.getLicenseType(licenseKey) ?? 'free';
  }

  private getLicenseType(licenseKey: string): string | null {
    try {
      const LicenseModule = requireEe('licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.getLicenseType(licenseKey);
    } catch {
      return null;
    }
  }
}
