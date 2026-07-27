import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';
import { Feature, FEATURES_REQUIRING_EE_MODULE } from '../../common/features';

@Injectable()
export class LicenseCheckService implements OnModuleInit {
  private readonly logger = new Logger(LicenseCheckService.name);
  private eeModulePresent: boolean | null = null;

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
        `eeModule=${this.eeModuleAvailable() ? 'present' : 'absent'} ` +
        `tier=${resolved !== null ? 'enterprise' : 'free'} ` +
        `featureCount=${resolved?.length ?? 0}`,
    );

    const withheld = this.withheldFeatures();
    if (withheld.length > 0) {
      this.logger.warn(
        `Not unlocking ${withheld.length} feature(s): their routes live in the ` +
          `apps/server/src/ee submodule, which is not provisioned. Unlocking ` +
          `them would make the UI call endpoints that return 404. ` +
          `Withheld: ${withheld.join(', ')}. See docs/ee-feature-status.md.`,
      );
    }
  }

  /**
   * Self-hosted feature unlock driven by SELF_HOSTED_UNLOCK_FEATURES.
   * Returns the unlocked feature set (or all features for "*"), or null when
   * unset / on cloud (where entitlements are plan-driven).
   *
   * Features whose backend lives in the `ee` submodule are removed when that
   * submodule is absent — flipping their flag there yields UI wired to routes
   * that do not exist. See FEATURES_REQUIRING_EE_MODULE.
   */
  private unlockedFeatures(): string[] | null {
    if (this.environmentService.isCloud()) {
      return null;
    }
    const unlock = this.environmentService.getSelfHostedUnlockFeatures();
    if (unlock.length === 0) {
      return null;
    }

    const requested = unlock.includes('*')
      ? (Object.values(Feature) as string[])
      : unlock;

    if (this.eeModuleAvailable()) {
      return requested;
    }
    return requested.filter(
      (feature) =>
        !(FEATURES_REQUIRING_EE_MODULE as string[]).includes(feature),
    );
  }

  /**
   * Features the operator asked for that we refused to unlock. Reported once at
   * boot so an empty EE panel is traceable to a missing submodule rather than
   * looking like a bug.
   */
  private withheldFeatures(): string[] {
    if (this.environmentService.isCloud() || this.eeModuleAvailable()) {
      return [];
    }
    const unlock = this.environmentService.getSelfHostedUnlockFeatures();
    if (unlock.length === 0) {
      return [];
    }
    const requested = unlock.includes('*')
      ? (Object.values(Feature) as string[])
      : unlock;
    return (FEATURES_REQUIRING_EE_MODULE as string[]).filter((feature) =>
      requested.includes(feature),
    );
  }

  /**
   * Whether the `ee` git submodule was provisioned into this build. Resolved
   * once — the answer cannot change while the process is running.
   */
  private eeModuleAvailable(): boolean {
    if (this.eeModulePresent === null) {
      this.eeModulePresent = this.requireLicenseModule() !== null;
    }
    return this.eeModulePresent;
  }

  private requireLicenseModule(): any | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../ee/licence/license.service');
    } catch {
      return null;
    }
  }

  private licenseService(): any | null {
    const LicenseModule = this.requireLicenseModule();
    if (!LicenseModule) return null;
    try {
      return this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
    } catch {
      return null;
    }
  }

  isValidEELicense(licenseKey: string): boolean {
    if (this.environmentService.isCloud()) {
      return true;
    }

    if (this.unlockedFeatures() !== null) {
      return true;
    }

    return this.licenseService()?.isValidEELicense(licenseKey) ?? false;
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

    return this.licenseService()?.hasFeature(licenseKey, feature) ?? false;
  }

  getFeatures(licenseKey: string): string[] {
    return this.licenseService()?.getFeatures(licenseKey) ?? [];
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
    return this.licenseService()?.getLicenseType(licenseKey) ?? null;
  }
}
