import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { UnableToDecrypt, UnableToInitialize } from './encryption.errors';
import { EnvironmentService } from '../environment/environment.service';

const APP_SECRET = 'test-app-secret-with-plenty-of-entropy-1234567890';

const buildService = (appSecret: string | undefined) => {
  const env = { getAppSecret: () => appSecret } as EnvironmentService;
  return new EncryptionService(env);
};

const decodeEnvelope = (encrypted: string) =>
  JSON.parse(Buffer.from(encrypted, 'base64').toString()) as {
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
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('handles empty string', () => {
      const encrypted = service.encrypt('');
      expect(service.decrypt(encrypted)).toBe('');
    });

    it('handles unicode (multi-byte UTF-8)', () => {
      const plaintext = 'héllo 🔐 世界';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('handles long plaintext (>1 block)', () => {
      const plaintext = 'a'.repeat(10_000);
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same input';
      const a = service.encrypt(plaintext);
      const b = service.encrypt(plaintext);
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe(plaintext);
      expect(service.decrypt(b)).toBe(plaintext);
    });
  });

  describe('cross-key isolation', () => {
    it('cannot decrypt ciphertext produced under a different APP_SECRET', () => {
      const other = buildService('totally-different-secret-value-9876543210');
      const encrypted = service.encrypt('secret');
      expect(() => other.decrypt(encrypted)).toThrow(UnableToDecrypt);
    });
  });

  describe('tamper detection', () => {
    it('rejects modified ciphertext', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      const tamperedCipher = Buffer.from(env.cipherText, 'base64');
      tamperedCipher[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        cipherText: tamperedCipher.toString('base64'),
      });
      expect(() => service.decrypt(tampered)).toThrow(UnableToDecrypt);
    });

    it('rejects modified auth tag', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      const tamperedTag = Buffer.from(env.authTag, 'base64');
      tamperedTag[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        authTag: tamperedTag.toString('base64'),
      });
      expect(() => service.decrypt(tampered)).toThrow(UnableToDecrypt);
    });

    it('rejects modified IV', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      const tamperedIV = Buffer.from(env.iv, 'base64');
      tamperedIV[0] ^= 0x01;
      const tampered = encodeEnvelope({
        ...env,
        iv: tamperedIV.toString('base64'),
      });
      expect(() => service.decrypt(tampered)).toThrow(UnableToDecrypt);
    });
  });

  describe('malformed payloads', () => {
    it('rejects non-base64 garbage', () => {
      expect(() => service.decrypt('!!!not-valid-base64!!!')).toThrow(
        UnableToDecrypt,
      );
    });

    it('rejects base64 of non-JSON', () => {
      const garbage = Buffer.from('not json at all').toString('base64');
      expect(() => service.decrypt(garbage)).toThrow(UnableToDecrypt);
    });

    it('rejects JSON missing required fields', () => {
      const partial = encodeEnvelope({
        iv: Buffer.alloc(12).toString('base64'),
        authTag: Buffer.alloc(16).toString('base64'),
      } as never);
      expect(() => service.decrypt(partial)).toThrow(UnableToDecrypt);
    });

    it('rejects wrong-length IV', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      const bad = encodeEnvelope({
        ...env,
        iv: Buffer.alloc(8).toString('base64'),
      });
      expect(() => service.decrypt(bad)).toThrow(UnableToDecrypt);
    });

    it('rejects wrong-length auth tag', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      const bad = encodeEnvelope({
        ...env,
        authTag: Buffer.alloc(8).toString('base64'),
      });
      expect(() => service.decrypt(bad)).toThrow(UnableToDecrypt);
    });
  });

  describe('envelope format', () => {
    it('returns base64 of JSON envelope with iv (12B), authTag (16B), cipherText', () => {
      const encrypted = service.encrypt('hello');
      const env = decodeEnvelope(encrypted);
      expect(Buffer.from(env.iv, 'base64')).toHaveLength(12);
      expect(Buffer.from(env.authTag, 'base64')).toHaveLength(16);
      expect(Buffer.from(env.cipherText, 'base64').length).toBeGreaterThan(0);
    });
  });
});
