import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionPurpose, EncryptionService } from './encryption.service';
import { UnableToDecrypt, UnableToInitialize } from './encryption.errors';
import { EnvironmentService } from '../environment/environment.service';

const APP_SECRET = 'test-app-secret-with-plenty-of-entropy-1234567890';
// Produced by the shipped v0.96.0 writer, with a fixed IV and a synthetic secret.
const LEGACY_SIEM_CIPHERTEXT =
  'eyJpdiI6IkFBRUNBd1FGQmdjSUNRb0wiLCJhdXRoVGFnIjoiZGZRbW1TVHdQck5uTzh3THFqMmhhUT09IiwiY2lwaGVyVGV4dCI6IjQxL0c1bVBlS0tVTkQ1ZW5vVk54M2V1eS9CNXluQVhJbWtCYmFLNlAifQ==';

const buildService = (appSecret: string | undefined) => {
  const env = { getAppSecret: () => appSecret } as EnvironmentService;
  return new EncryptionService(env);
};

const decodeEnvelope = (encrypted: string) =>
  JSON.parse(Buffer.from(encrypted, 'base64').toString()) as {
    version?: number;
    algorithm?: string;
    keyId?: string;
    purpose?: string;
    iv: string;
    authTag: string;
    cipherText: string;
  };

const encodeEnvelope = (envelope: {
  iv: string;
  authTag: string;
  cipherText: string;
}) => Buffer.from(JSON.stringify(envelope)).toString('base64');

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: EnvironmentService,
          useValue: { getAppSecret: () => APP_SECRET },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  describe('initialization', () => {
    it('compiles via Nest DI', () => {
      expect(service).toBeDefined();
    });

    it('throws UnableToInitialize when APP_SECRET is missing', () => {
      expect(() => buildService(undefined)).toThrow(UnableToInitialize);
      expect(() => buildService('')).toThrow(UnableToInitialize);
    });
  });

  describe('encrypt + decrypt round-trip', () => {
    it('decrypts back to the original plaintext', () => {
      const plaintext = 'hello world';
      const encrypted = service.encrypt(
        plaintext,
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      expect(
        service.decrypt(encrypted, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toBe(plaintext);
    });

    it('handles empty string', () => {
      const encrypted = service.encrypt('', EncryptionPurpose.SIEM_CREDENTIALS);
      expect(
        service.decrypt(encrypted, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toBe('');
    });

    it('handles unicode (multi-byte UTF-8)', () => {
      const plaintext = 'héllo 🔐 世界';
      const encrypted = service.encrypt(
        plaintext,
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      expect(
        service.decrypt(encrypted, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toBe(plaintext);
    });

    it('handles long plaintext (>1 block)', () => {
      const plaintext = 'a'.repeat(10_000);
      const encrypted = service.encrypt(
        plaintext,
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      expect(
        service.decrypt(encrypted, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toBe(plaintext);
    });

    it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same input';
      const a = service.encrypt(plaintext, EncryptionPurpose.SIEM_CREDENTIALS);
      const b = service.encrypt(plaintext, EncryptionPurpose.SIEM_CREDENTIALS);
      expect(a).not.toBe(b);
      expect(service.decrypt(a, EncryptionPurpose.SIEM_CREDENTIALS)).toBe(
        plaintext,
      );
      expect(service.decrypt(b, EncryptionPurpose.SIEM_CREDENTIALS)).toBe(
        plaintext,
      );
    });
  });

  describe('cross-key isolation', () => {
    it('cannot decrypt ciphertext produced under a different APP_SECRET', () => {
      const other = buildService('totally-different-secret-value-9876543210');
      const encrypted = service.encrypt(
        'secret',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      expect(() =>
        other.decrypt(encrypted, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });
  });

  describe('tamper detection', () => {
    it('rejects modified ciphertext', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      const tamperedCipher = Buffer.from(env.cipherText, 'base64');
      tamperedCipher[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        cipherText: tamperedCipher.toString('base64'),
      });
      expect(() =>
        service.decrypt(tampered, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects modified auth tag', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      const tamperedTag = Buffer.from(env.authTag, 'base64');
      tamperedTag[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        authTag: tamperedTag.toString('base64'),
      });
      expect(() =>
        service.decrypt(tampered, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects modified IV', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      const tamperedIV = Buffer.from(env.iv, 'base64');
      tamperedIV[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        iv: tamperedIV.toString('base64'),
      });
      expect(() =>
        service.decrypt(tampered, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });
  });

  describe('malformed payloads', () => {
    it('rejects non-base64 garbage', () => {
      expect(() =>
        service.decrypt(
          '!!!not-valid-base64!!!',
          EncryptionPurpose.SIEM_CREDENTIALS,
        ),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects base64 of non-JSON', () => {
      const garbage = Buffer.from('not json at all').toString('base64');
      expect(() =>
        service.decrypt(garbage, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects JSON missing required fields', () => {
      const partial = encodeEnvelope({
        iv: Buffer.alloc(12).toString('base64'),
        authTag: Buffer.alloc(16).toString('base64'),
      } as never);
      expect(() =>
        service.decrypt(partial, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects wrong-length IV', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      const bad = encodeEnvelope({
        ...env,
        iv: Buffer.alloc(8).toString('base64'),
      });
      expect(() =>
        service.decrypt(bad, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });

    it('rejects wrong-length auth tag', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      const bad = encodeEnvelope({
        ...env,
        authTag: Buffer.alloc(8).toString('base64'),
      });
      expect(() =>
        service.decrypt(bad, EncryptionPurpose.SIEM_CREDENTIALS),
      ).toThrow(UnableToDecrypt);
    });
  });

  describe('envelope format', () => {
    it('writes an authenticated v2 envelope with a 16-byte IV and 32-byte tag', () => {
      const encrypted = service.encrypt(
        'hello',
        EncryptionPurpose.SIEM_CREDENTIALS,
      );
      const env = decodeEnvelope(encrypted);
      expect(env).toMatchObject({
        version: 2,
        algorithm: 'A256CBC-HS512',
        keyId: 'app-secret',
        purpose: 'siem-credentials',
      });
      expect(Buffer.from(env.iv, 'base64')).toHaveLength(16);
      expect(Buffer.from(env.authTag, 'base64')).toHaveLength(32);
      expect(Buffer.from(env.cipherText, 'base64').length).toBeGreaterThan(0);
    });
  });

  it('still decrypts credentials produced by the shipped SIEM writer', () => {
    expect(
      service.decrypt(
        LEGACY_SIEM_CIPHERTEXT,
        EncryptionPurpose.SIEM_CREDENTIALS,
      ),
    ).toBe('{"token":"shipped-siem-token"}');
  });

  describe('purpose and version isolation', () => {
    it.each(['encrypt', 'decrypt'] as const)(
      '%s requires an explicit purpose',
      (operation) => {
        const input =
          operation === 'encrypt' ? 'secret' : LEGACY_SIEM_CIPHERTEXT;
        expect(() =>
          service[operation](input, undefined as unknown as EncryptionPurpose),
        ).toThrow('Unsupported encryption purpose.');
      },
    );

    it.each(Object.values(EncryptionPurpose))(
      'round-trips %s independently',
      (purpose) => {
        const encrypted = service.encrypt('secret', purpose);
        expect(service.decrypt(encrypted, purpose)).toBe('secret');
        for (const other of Object.values(EncryptionPurpose)) {
          if (other !== purpose) {
            expect(() => service.decrypt(encrypted, other)).toThrow(
              UnableToDecrypt,
            );
          }
        }
      },
    );

    it('does not accept legacy SIEM ciphertext as tokens or a completion ticket', () => {
      expect(() =>
        service.decrypt(
          LEGACY_SIEM_CIPHERTEXT,
          EncryptionPurpose.INTEGRATION_TOKENS,
        ),
      ).toThrow(UnableToDecrypt);
      expect(() =>
        service.decrypt(
          LEGACY_SIEM_CIPHERTEXT,
          EncryptionPurpose.OAUTH_COMPLETION,
        ),
      ).toThrow(UnableToDecrypt);
    });

    it.each([
      { version: 3 },
      { version: null },
      { algorithm: 'aes-256-gcm' },
      { keyId: 'unknown' },
      { purpose: EncryptionPurpose.INTEGRATION_TOKENS },
    ])('rejects changed authenticated metadata %j', (change) => {
      const envelope = decodeEnvelope(
        service.encrypt('secret', EncryptionPurpose.SIEM_CREDENTIALS),
      );
      const modified = encodeEnvelope({ ...envelope, ...change });
      const purpose = change.purpose ?? EncryptionPurpose.SIEM_CREDENTIALS;
      expect(() => service.decrypt(modified, purpose)).toThrow(UnableToDecrypt);
    });

    it('does not fall back to legacy decryption when the v2 header is stripped', () => {
      const { iv, authTag, cipherText } = decodeEnvelope(
        service.encrypt('secret', EncryptionPurpose.SIEM_CREDENTIALS),
      );
      expect(() =>
        service.decrypt(
          encodeEnvelope({ iv, authTag, cipherText }),
          EncryptionPurpose.SIEM_CREDENTIALS,
        ),
      ).toThrow(UnableToDecrypt);
    });

    it.each([null, [], 'string', 1, { iv: 1, authTag: [], cipherText: null }])(
      'rejects malformed JSON envelopes %j',
      (value) => {
        expect(() =>
          service.decrypt(
            Buffer.from(JSON.stringify(value)).toString('base64'),
            EncryptionPurpose.SIEM_CREDENTIALS,
          ),
        ).toThrow(UnableToDecrypt);
      },
    );

    it('rejects noncanonical base64 fields instead of silently discarding characters', () => {
      const envelope = decodeEnvelope(
        service.encrypt('secret', EncryptionPurpose.SIEM_CREDENTIALS),
      );
      expect(() =>
        service.decrypt(
          encodeEnvelope({ ...envelope, iv: envelope.iv + '!' }),
          EncryptionPurpose.SIEM_CREDENTIALS,
        ),
      ).toThrow(UnableToDecrypt);
    });
  });
});
