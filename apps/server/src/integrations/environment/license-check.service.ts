import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';
import { Feature } from '../../common/features';

@Injectable()
export class LicenseCheckService implements OnModuleInit {
  private readonly logger = new Logger(LicenseCheckService.name);

  constructor(
    private moduleRef: ModuleRef,
    private environmentService: EnvironmentService,
  ) {}

  onModuleInit(): void {
    const cloud = this.environmentService.isCloud();
    const unlock = this.environmentService.getSelfHostedUnlockFeatures();
    const resolved = this.unlockedFeatures();
    this.logger.log(
      `License/entitlement config: cloud=${cloud} ` +
        `SELF_HOSTED_UNLOCK_FEATURES=${JSON.stringify(unlock)} ` +
        `unlockActive=${resolved !== null} ` +
        `tier=${resolved !== null ? 'enterprise' : 'free'} ` +
        `featureCount=${resolved?.length ?? 0}`,
    );
  }

  /**
   * Self-hosted feature unlock driven by SELF_HOSTED_UNLOCK_FEATURES.
   * Returns the unlocked feature set (or all features for "*"), or null when
   * unset / on cloud (where entitlements are plan-driven).
   */
  private unlockedFeatures(): string[] | null {
    if (this.environmentService.isCloud()) {
      return null;
    }
    const unlock = this.environmentService.getSelfHostedUnlockFeatures();
    if (unlock.length === 0) {
      return null;
    }
    return unlock.includes('*') ? Object.values(Feature) : unlock;
  }

  isValidEELicense(licenseKey: string): boolean {
    if (this.environmentService.isCloud()) {
      return true;
    }

    if (this.unlockedFeatures() !== null) {
      return true;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getFeaturesForCloudPlan } = require('../../ee/licence/feature-registry');
        return getFeaturesForCloudPlan(plan).has(feature);
      } catch {
        return false;
      }
    }

    const unlocked = this.unlockedFeatures();
    if (unlocked !== null) {
      return unlocked.includes(feature);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getFeaturesForCloudPlan } = require('../../ee/licence/feature-registry');
        return [...getFeaturesForCloudPlan(plan)];
      } catch {
        return [];
      }
    }

    const unlocked = this.unlockedFeatures();
    if (unlocked !== null) {
      return unlocked;
    }

    return this.getFeatures(licenseKey);
  }

  resolveTier(licenseKey: string, plan: string): string {
    if (this.environmentService.isCloud()) {
      return plan ?? 'standard';
    }

    if (this.unlockedFeatures() !== null) {
      return 'enterprise';
    }

    return this.getLicenseType(licenseKey) ?? 'free';
  }

  private getLicenseType(licenseKey: string): string | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.getLicenseType(licenseKey);
    } catch {
      return null;
    }
  }
}
