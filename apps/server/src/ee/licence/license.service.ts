import { Injectable } from '@nestjs/common';
import { Feature } from '../../common/features';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';

const ALL_FEATURES = Object.values(Feature);

@Injectable()
export class LicenseService {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  isValidEELicense(_licenseKey: string): boolean {
    return true;
  }

  hasFeature(_licenseKey: string, _feature: string): boolean {
    return true;
  }

  getFeatures(_licenseKey: string): string[] {
    return ALL_FEATURES;
  }

  getLicenseType(_licenseKey: string): string {
    return 'enterprise';
  }

  async getLicenseInfo(workspaceId: string) {
    const workspace = await this.workspaceRepo.findById(workspaceId, {
      withLicenseKey: true,
    });

    return {
      id: workspaceId,
      customerName: workspace?.name ?? 'Self-hosted',
      seatCount: 999,
      licenseType: 'enterprise' as const,
      issuedAt: workspace?.createdAt ?? new Date(),
      expiresAt: new Date('2099-12-31'),
      trial: false,
    };
  }

  async activateLicense(workspaceId: string, licenseKey: string) {
    await this.workspaceRepo.updateWorkspace({ licenseKey }, workspaceId);
    return this.getLicenseInfo(workspaceId);
  }

  async removeLicense(workspaceId: string) {
    await this.workspaceRepo.updateWorkspace({ licenseKey: null }, workspaceId);
  }
}
