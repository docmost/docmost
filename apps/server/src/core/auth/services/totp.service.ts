import { Injectable } from '@nestjs/common';
import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { hashFastCodes, hashPassword } from '../../../common/helpers/utils';

export interface TotpSetup {
  secret: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class TotpService {
  constructor(private readonly environmentService: EnvironmentService) {}

  async generateTotpSetup(userEmail: string, serviceName = 'Docmost'): Promise<TotpSetup> {
    const secret = new Secret().base32;
    
    const totp = new TOTP({
      issuer: serviceName,
      label: userEmail,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(totp.toString());

    return {
      secret,
      qrCodeDataUrl,
    };
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      const totp = new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });

      // Validate token with a window of +-1 period (90 seconds total)
      return totp.validate({ token, window: 1 }) !== null;
    } catch {
      return false;
    }
  }

  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const secret = this.environmentService.getAppSecret();
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const secret = this.environmentService.getAppSecret();
    const key = crypto.scryptSync(secret, 'salt', 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashedCodes = [];
    for (const code of codes) {
      const hashedCode = await hashFastCodes(code.toUpperCase());
      hashedCodes.push(hashedCode);
    }
    return hashedCodes;
  }


  async verifyBackupCode(code: string, hashedCodes: string[]): Promise<{ isValid: boolean; codeIndex: number }> {
    if (code.length !== 8) {
      return { isValid: false, codeIndex: -1 };
    }

    const upperCode = code.toUpperCase();
    
    for (let i = 0; i < hashedCodes.length; i++) {
      try {
        const isMatch = await bcrypt.compare(upperCode, hashedCodes[i]);
        if (isMatch) {
          return { isValid: true, codeIndex: i };
        }
      } catch (error) {
        continue;
      }
    }
    
    return { isValid: false, codeIndex: -1 };
  }

  removeUsedBackupCode(codeIndex: number, hashedCodes: string[]): string[] {
    if (codeIndex >= 0 && codeIndex < hashedCodes.length) {
      return hashedCodes.filter((_, index) => index !== codeIndex);
    }
    return hashedCodes;
  }
}
