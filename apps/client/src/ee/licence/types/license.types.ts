export interface ILicenseInfo {
  id: string;
  customerName: string;
  seatCount: number;
  issuedAt: Date;
  expiresAt: Date;
  trial: boolean;
}