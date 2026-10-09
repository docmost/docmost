// https://github.com/nhedger/nestjs-encryption - MIT
import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { UnableToDecrypt, UnableToInitialize } from './encryption.errors';
import { EnvironmentService } from '../environment/environment.service';

const ALGORITHM = 'aes-256-gcm';
const KEY_DOMAIN = 'docmost:encryption:v1';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

type AEADPayload<TFormat = string | Buffer> = {
  iv: TFormat;
  authTag: TFormat;
  cipherText: TFormat;
};

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(environmentService: EnvironmentService) {
    const appSecret = environmentService.getAppSecret();
    if (!appSecret) {
      throw new UnableToInitialize('APP_SECRET is not set.');
    }
    this.key = createHash('sha256')
      .update(KEY_DOMAIN)
      .update(appSecret)
      .digest();
  }

  public encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const cipherText = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const aead: AEADPayload<string> = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      cipherText: cipherText.toString('base64'),
    };

    return Buffer.from(JSON.stringify(aead)).toString('base64');
  }

  public decrypt(encrypted: string): string {
    try {
      const { iv, authTag, cipherText } = this.decodeAEADPayload(encrypted);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(cipherText),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch (e: unknown) {
      throw new UnableToDecrypt((e as Error).message);
    }
  }

  private decodeAEADPayload(encodedPayload: string): AEADPayload<Buffer> {
    const payload = Buffer.from(encodedPayload, 'base64');

    let deserializedPkg: Record<string, unknown>;
    try {
      deserializedPkg = JSON.parse(payload.toString());
    } catch {
      throw new Error('The decoded AEAD payload is not a valid JSON string.');
    }

    for (const field of ['iv', 'authTag', 'cipherText']) {
      if (!Object.prototype.hasOwnProperty.call(deserializedPkg, field)) {
        throw new Error(`The AEAD payload is missing the ${field} field.`);
      }
    }

    const iv = Buffer.from(deserializedPkg.iv as string, 'base64');
    if (iv.length !== IV_LENGTH) {
      throw new Error(
        `The decoded IV is not the correct length. Expected ${IV_LENGTH} bytes, got ${iv.length} bytes.`,
      );
    }

    const authTag = Buffer.from(deserializedPkg.authTag as string, 'base64');
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(
        `The decoded auth tag is not the correct length. Expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length} bytes.`,
      );
    }

    const cipherText = Buffer.from(
      deserializedPkg.cipherText as string,
      'base64',
    );

    return { iv, authTag, cipherText };
  }
}
