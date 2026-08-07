import { decryptSecret, encryptSecret } from './encryption.helper';

describe('encryption.helper', () => {
  const appSecret = 'test-app-secret-value';

  it('round-trips a value back to its plaintext', () => {
    const plaintext = 'lin_oauth_access_token_abc123';
    const encrypted = encryptSecret(plaintext, appSecret);

    expect(encrypted).not.toEqual(plaintext);
    expect(decryptSecret(encrypted, appSecret)).toEqual(plaintext);
  });

  it('handles unicode and empty strings', () => {
    for (const plaintext of ['', 'токен🔐', 'a'.repeat(5000)]) {
      expect(decryptSecret(encryptSecret(plaintext, appSecret), appSecret)).toEqual(
        plaintext,
      );
    }
  });

  it('produces a different ciphertext each time (unique IV)', () => {
    const plaintext = 'same-secret';
    const a = encryptSecret(plaintext, appSecret);
    const b = encryptSecret(plaintext, appSecret);

    expect(a).not.toEqual(b);
    expect(decryptSecret(a, appSecret)).toEqual(plaintext);
    expect(decryptSecret(b, appSecret)).toEqual(plaintext);
  });

  it('fails to decrypt with the wrong app secret', () => {
    const encrypted = encryptSecret('secret', appSecret);
    expect(() => decryptSecret(encrypted, 'a-different-secret')).toThrow();
  });

  it('rejects a tampered ciphertext (GCM auth tag)', () => {
    const encrypted = encryptSecret('secret', appSecret);
    const raw = Buffer.from(encrypted, 'base64');
    // flip a bit in the ciphertext body (after iv[0..12] and authTag[12..28])
    raw[raw.length - 1] ^= 0x01;
    const tampered = raw.toString('base64');

    expect(() => decryptSecret(tampered, appSecret)).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const encrypted = encryptSecret('secret', appSecret);
    const raw = Buffer.from(encrypted, 'base64');
    // flip a bit inside the auth tag (bytes 12..28)
    raw[13] ^= 0x01;
    const tampered = raw.toString('base64');

    expect(() => decryptSecret(tampered, appSecret)).toThrow();
  });
});
