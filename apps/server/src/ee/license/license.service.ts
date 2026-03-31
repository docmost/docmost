import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as jwt from 'jsonwebtoken';

export interface ILicenseInfo {
  id: string;
  customerName: string;
  seatCount: number;
  issuedAt: Date;
  expiresAt: Date;
  trial: boolean;
}

const DEMO_LICENSE_SECRET = 'DOCMOST_DEMO_LICENSE_SECRET_KEY_2024';

const ALL_FEATURES = [
  'sso:custom',
  'sso:google',
  'mfa',
  'api:keys',
  'comment:resolution',
  'page:permissions',
  'ai',
  'import:confluence',
  'import:docx',
  'attachment:indexing',
  'security:settings',
  'mcp',
  'scim',
  'page:verification',
  'audit:logs',
  'retention',
  'sharing:controls',
];

@Injectable()
export class LicenseService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async getLicenseInfo(workspaceId: string): Promise<ILicenseInfo | null> {
    const workspace = await this.db
      .selectFrom('workspaces')
      .select(['licenseKey'])
      .where('id', '=', workspaceId)
      .executeTakeFirst();

    if (!workspace?.licenseKey) {
      return null;
    }

    return this.decodeLicenseKey(workspace.licenseKey);
  }

  async activateLicense(
    workspaceId: string,
    licenseKey: string,
  ): Promise<ILicenseInfo> {
    const cleanKey = licenseKey.replace(/\s+/g, '');
    const licenseInfo = this.decodeLicenseKey(cleanKey);

    await this.db
      .updateTable('workspaces')
      .set({ licenseKey: cleanKey })
      .where('id', '=', workspaceId)
      .execute();

    return licenseInfo;
  }

  async removeLicense(workspaceId: string): Promise<void> {
    await this.db
      .updateTable('workspaces')
      .set({ licenseKey: null })
      .where('id', '=', workspaceId)
      .execute();
  }

  decodeLicenseKey(licenseKey: string): ILicenseInfo {
    try {
      // Try to decode as JWT (with or without verification for demo)
      const decoded = jwt.decode(licenseKey?.replace(/\s+/g, '')) as ILicenseInfo;

      if (!decoded || !decoded.id || !decoded.customerName) {
        throw new Error('Invalid license format');
      }

      return {
        id: decoded.id,
        customerName: decoded.customerName,
        seatCount: decoded.seatCount || 999,
        issuedAt: new Date(decoded.issuedAt),
        expiresAt: new Date(decoded.expiresAt),
        trial: decoded.trial || false,
      };
    } catch {
      throw new BadRequestException('Invalid license key');
    }
  }

  generateDemoLicenseKey(): string {
    const payload: ILicenseInfo = {
      id: 'demo-license-001',
      customerName: 'Demo User',
      seatCount: 999,
      issuedAt: new Date('2024-01-01T00:00:00.000Z'),
      expiresAt: new Date('2099-12-31T23:59:59.999Z'),
      trial: false,
    };

    return jwt.sign(payload, DEMO_LICENSE_SECRET, { algorithm: 'HS256' });
  }

  isValidEELicense(licenseKey: string): boolean {
    try {
      const info = this.decodeLicenseKey(licenseKey);
      return new Date(info.expiresAt) > new Date();
    } catch {
      return false;
    }
  }

  getLicenseType(licenseKey: string): string | null {
    try {
      const info = this.decodeLicenseKey(licenseKey);
      if (!this.isValidEELicense(licenseKey)) return null;
      return info.trial ? 'trial' : 'enterprise';
    } catch {
      return null;
    }
  }

  getFeatures(licenseKey: string): string[] {
    if (!this.isValidEELicense(licenseKey)) return [];
    return ALL_FEATURES;
  }

  hasFeature(licenseKey: string, feature: string): boolean {
    return this.getFeatures(licenseKey).includes(feature);
  }

  generateLicenseKey(opts: {
    customerName: string;
    seatCount: number;
    expiresAt: string;
    trial?: boolean;
  }): string {
    const payload: ILicenseInfo = {
      id: `license-${Date.now()}`,
      customerName: opts.customerName,
      seatCount: opts.seatCount,
      issuedAt: new Date(),
      expiresAt: new Date(opts.expiresAt),
      trial: opts.trial ?? false,
    };

    return jwt.sign(payload, DEMO_LICENSE_SECRET, { algorithm: 'HS256' });
  }
}
