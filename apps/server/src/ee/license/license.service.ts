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
    const licenseInfo = this.decodeLicenseKey(licenseKey);

    await this.db
      .updateTable('workspaces')
      .set({ licenseKey })
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
      const decoded = jwt.decode(licenseKey) as ILicenseInfo;

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
