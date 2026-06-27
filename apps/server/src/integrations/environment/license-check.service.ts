import { Injectable } from '@nestjs/common';
import { Feature } from '../../common/features';

const ALL_EE_FEATURES = Object.values(Feature);

@Injectable()
export class LicenseCheckService {
  isValidEELicense(_licenseKey: string): boolean {
    return true;
  }

  hasFeature(_licenseKey: string, _feature: string, _plan?: string): boolean {
    return true;
  }

  getFeatures(_licenseKey: string): string[] {
    return ALL_EE_FEATURES;
  }

  resolveFeatures(_licenseKey: string, _plan: string): string[] {
    return ALL_EE_FEATURES;
  }

  resolveTier(_licenseKey: string, _plan: string): string {
    return 'enterprise';
  }
}
