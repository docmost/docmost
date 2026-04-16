import { Injectable } from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { ALL_EE_FEATURES } from './feature-registry';
import { FeatureKey } from '../../common/features';

export type LicenseInfo = {
  id: string;
  customerName: string;
  seatCount: number;
  licenseType: 'business' | 'enterprise';
  issuedAt: Date;
  expiresAt: Date;
  trial: boolean;
};

const EE_ENABLED_SEAT_COUNT = 100;

@Injectable()
export class LicenseService {
  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  isValidEELicense(licenseKey?: string): boolean {
    return this.environmentService.isEEEnabled() || Boolean(licenseKey);
  }

  hasFeature(licenseKey: string | undefined, feature: FeatureKey): boolean {
    return this.isValidEELicense(licenseKey) && ALL_EE_FEATURES.includes(feature);
  }

  getFeatures(licenseKey?: string): FeatureKey[] {
    if (!this.isValidEELicense(licenseKey)) {
      return [];
    }

    return [...ALL_EE_FEATURES];
  }

  getLicenseType(licenseKey?: string): 'enterprise' | null {
    return this.isValidEELicense(licenseKey) ? 'enterprise' : null;
  }

  async getLicenseInfo(
    workspaceId: string,
    licenseKey?: string,
  ): Promise<LicenseInfo | null> {
    if (!this.isValidEELicense(licenseKey)) {
      return null;
    }

    const [workspace, memberCount] = await Promise.all([
      this.workspaceRepo.findById(workspaceId, {
        withLicenseKey: true,
      }),
      this.workspaceRepo.getActiveUserCount(workspaceId),
    ]);

    const isSyntheticEeLicense =
      this.environmentService.isEEEnabled() && !licenseKey;
    const seatCount = isSyntheticEeLicense
      ? EE_ENABLED_SEAT_COUNT
      : Math.max(memberCount, 25);
    const now = new Date();
    const issuedAt = new Date(now);
    issuedAt.setMonth(issuedAt.getMonth() - 1);
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    return {
      id: licenseKey || `ee-enabled-${workspaceId}`,
      customerName: workspace?.name || 'Docmost Workspace',
      seatCount,
      licenseType: 'enterprise',
      issuedAt,
      expiresAt,
      trial: false,
    };
  }
}
