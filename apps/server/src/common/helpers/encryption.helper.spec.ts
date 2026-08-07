import { decryptString, encryptString } from './encryption.helper';

const SECRET = 'test-app-secret-do-not-use-in-prod';
const INFO = 'integration-oauth-token-v1';

describe('encryption.helper', () => {
  describe('encryptString → decryptString', () => {
    it('round-trips ASCII plaintext', () => {
      const ct = encryptString('hello world', SECRET, INFO);
      expect(decryptString(ct, SECRET, INFO)).toBe('hello world');
    });

    it('round-trips unicode plaintext', () => {
      const ct = encryptString('héllo 🌍 résumé', SECRET, INFO);
      expect(decryptString(ct, SECRET, INFO)).toBe('héllo 🌍 résumé');
    });

    it('round-trips long plaintext (>1KB)', () => {
      const long = 'a'.repeat(4096);
      const ct = encryptString(long, SECRET, INFO);
      expect(decryptString(ct, SECRET, INFO)).toBe(long);
    });

    it('produces a different ciphertext for the same plaintext (random IV)', () => {
      const a = encryptString('same', SECRET, INFO);
      const b = encryptString('same', SECRET, INFO);
      expect(a).not.toBe(b);
      expect(decryptString(a, SECRET, INFO)).toBe('same');
      expect(decryptString(b, SECRET, INFO)).toBe('same');
    });

    it('emits the v1: format prefix', () => {
      const ct = encryptString('x', SECRET, INFO);
      expect(ct.startsWith('v1:')).toBe(true);
      expect(ct.split(':').length).toBe(4);
    });
  });

  describe('decryptString failures', () => {
    it('throws when the auth tag is wrong (tampering)', () => {
      const ct = encryptString('hello', SECRET, INFO);
      const parts = ct.split(':');
      // Flip a bit in the auth tag.
      const tampered = Buffer.from(parts[2], 'hex');
      tampered[0] ^= 0xff;
      const broken = [parts[0], parts[1], tampered.toString('hex'), parts[3]].join(':');
      expect(() => decryptString(broken, SECRET, INFO)).toThrow();
    });

    it('throws when the secret is wrong', () => {
      const ct = encryptString('hello', SECRET, INFO);
      expect(() => decryptString(ct, 'different-secret', INFO)).toThrow();
    });

    it('throws when the info string is wrong (domain separation)', () => {
      const ct = encryptString('hello', SECRET, INFO);
      expect(() => decryptString(ct, SECRET, 'wrong-info')).toThrow();
    });

    it('throws on unrecognized blob format', () => {
      expect(() => decryptString('not-a-blob', SECRET, INFO)).toThrow(/unrecognized blob format/);
      expect(() => decryptString('v0:aa:bb:cc', SECRET, INFO)).toThrow(/unrecognized blob format/);
    });

    it('throws on empty blob', () => {
      expect(() => decryptString('', SECRET, INFO)).toThrow(/empty/);
    });
  });

  describe('encryptString failures', () => {
    it('throws on empty secret', () => {
      expect(() => encryptString('hello', '', INFO)).toThrow(/secret is required/);
    });
  });
});
