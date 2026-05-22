export type LicenseType = 'business' | 'enterprise';

export interface ILicenseInfo {
  id: string;
  customerName: string;
  seatCount: number;
  licenseType: LicenseType;
  issuedAt: Date;
  expiresAt: Date;
  trial: boolean;
}