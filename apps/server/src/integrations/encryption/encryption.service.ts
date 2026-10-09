import { Injectable } from '@nestjs/common';
import {
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { UnableToDecrypt, UnableToInitialize } from './encryption.errors';
import { EnvironmentService } from '../environment/environment.service';
import {
  decryptA256CbcHs512,
  encryptA256CbcHs512,
  V2_ALGORITHM,
  V2_IV_LENGTH,
  V2_KEY_LENGTH,
} from './a256cbc-hs512';

export enum EncryptionPurpose {
  SIEM_CREDENTIALS = 'siem-credentials',
  INTEGRATION_TOKENS = 'integration-tokens',
  OAUTH_COMPLETION = 'oauth-completion',
}

const KEY_ID = 'app-secret';
const V2_KEY_DOMAIN = 'docmost:encryption:v2';
const LEGACY_KEY_DOMAIN = 'docmost:encryption:v1';
const PAYLOAD_FIELDS = ['iv', 'authTag', 'cipherText'];
const HEADER_FIELDS = ['version', 'algorithm', 'keyId', 'purpose'];

type BinaryPayload = { iv: Buffer; authTag: Buffer; cipherText: Buffer };
type V2Header = {
  version: 2;
  algorithm: typeof V2_ALGORITHM;
  keyId: typeof KEY_ID;
  purpose: EncryptionPurpose;
};
type DecodedPayload =
  | { version: 1; payload: BinaryPayload }
  | { version: 2; payload: BinaryPayload; header: V2Header };

@Injectable()
export class EncryptionService {
  private readonly appSecret: string;
  private readonly keys = new Map<EncryptionPurpose, Buffer>();

  constructor(environmentService: EnvironmentService) {
    this.appSecret = environmentService.getAppSecret();
    if (!this.appSecret) {
      throw new UnableToInitialize('APP_SECRET is not set.');
    }
  }

  // Every consumer must select its purpose; only SIEM can read the shipped
  // unversioned format.
  public encrypt(plaintext: string, purpose: EncryptionPurpose): string {
    const header = this.header(purpose);
    const { iv, authTag, cipherText } = encryptA256CbcHs512(
      Buffer.from(plaintext, 'utf8'),
      this.keyFor(purpose),
      randomBytes(V2_IV_LENGTH),
      this.aad(header),
    );
    return Buffer.from(
      JSON.stringify({
        ...header,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        cipherText: cipherText.toString('base64'),
      }),
    ).toString('base64');
  }

  public decrypt(encrypted: string, purpose: EncryptionPurpose): string {
    try {
      this.assertPurpose(purpose);
      const decoded = this.decode(encrypted);
      if (decoded.version === 1) {
        if (purpose !== EncryptionPurpose.SIEM_CREDENTIALS) {
          throw new Error(
            'Legacy ciphertext is only supported for SIEM credentials.',
          );
        }
        return this.decryptLegacy(decoded.payload);
      }
      if (decoded.header.purpose !== purpose) {
        throw new Error('Ciphertext purpose does not match.');
      }
      return decryptA256CbcHs512(
        decoded.payload,
        this.keyFor(purpose),
        this.aad(decoded.header),
      ).toString('utf8');
    } catch (e: unknown) {
      throw new UnableToDecrypt((e as Error).message);
    }
  }

  private keyFor(purpose: EncryptionPurpose): Buffer {
    this.assertPurpose(purpose);
    let key = this.keys.get(purpose);
    if (!key) {
      // Derive 32-byte MAC_KEY || 32-byte ENC_KEY via the native provider.
      key = Buffer.from(
        hkdfSync(
          'sha256',
          this.appSecret,
          V2_KEY_DOMAIN,
          `${V2_ALGORITHM}:${purpose}`,
          V2_KEY_LENGTH,
        ),
      );
      this.keys.set(purpose, key);
    }
    return key;
  }

  private header(purpose: EncryptionPurpose): V2Header {
    this.assertPurpose(purpose);
    return { version: 2, algorithm: V2_ALGORITHM, keyId: KEY_ID, purpose };
  }

  private aad(header: V2Header): Buffer {
    // Fixed field order makes authentication independent of JSON property order.
    return Buffer.from(JSON.stringify(header), 'utf8');
  }

  private assertPurpose(
    purpose: unknown,
  ): asserts purpose is EncryptionPurpose {
    if (
      !Object.values(EncryptionPurpose).includes(purpose as EncryptionPurpose)
    ) {
      throw new Error('Unsupported encryption purpose.');
    }
  }

  private decode(encrypted: string): DecodedPayload {
    const value: unknown = JSON.parse(
      this.decodeBase64(encrypted).toString('utf8'),
    );
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('The ciphertext envelope must be an object.');
    }
    const envelope = value as Record<string, unknown>;
    const hasVersion = Object.prototype.hasOwnProperty.call(
      envelope,
      'version',
    );
    const fields = hasVersion
      ? [...HEADER_FIELDS, ...PAYLOAD_FIELDS]
      : PAYLOAD_FIELDS;
    if (
      Object.keys(envelope).length !== fields.length ||
      !fields.every((field) =>
        Object.prototype.hasOwnProperty.call(envelope, field),
      )
    ) {
      throw new Error('Invalid ciphertext envelope fields.');
    }
    const payload = {
      iv: this.decodeBase64(envelope.iv),
      authTag: this.decodeBase64(envelope.authTag),
      cipherText: this.decodeBase64(envelope.cipherText),
    };
    if (!hasVersion) {
      if (payload.iv.length !== 12 || payload.authTag.length !== 16) {
        throw new Error('Invalid legacy ciphertext IV or tag length.');
      }
      return { version: 1, payload };
    }
    if (
      envelope.version !== 2 ||
      envelope.algorithm !== V2_ALGORITHM ||
      envelope.keyId !== KEY_ID
    ) {
      throw new Error(
        'Unsupported ciphertext version, algorithm or key identifier.',
      );
    }
    this.assertPurpose(envelope.purpose);
    return { version: 2, payload, header: this.header(envelope.purpose) };
  }

  private decodeBase64(value: unknown): Buffer {
    if (typeof value !== 'string') {
      throw new Error('Ciphertext fields must be base64 strings.');
    }
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value) {
      throw new Error('Invalid base64 ciphertext encoding.');
    }
    return decoded;
  }

  private decryptLegacy({ iv, authTag, cipherText }: BinaryPayload): string {
    // Preserve the shipped derivation exactly. It is never used for new writes.
    const key = createHash('sha256')
      .update(LEGACY_KEY_DOMAIN)
      .update(this.appSecret)
      .digest();
    const decipher = createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: 16,
    });
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]).toString('utf8');
  }
}
