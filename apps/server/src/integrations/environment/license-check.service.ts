import { Injectable } from '@nestjs/common';

@Injectable()
export class LicenseCheckService {
  hasFeature(_licenseKey: string, _feature: string, _plan?: string): boolean {
    return false;
  }

  getFeatures(_licenseKey: string): string[] {
    return [];
  }

  resolveFeatures(_licenseKey: string, _plan: string): string[] {
    return [];
  }

  resolveTier(_licenseKey: string, _plan: string): string {
    return 'free';
  }
}
