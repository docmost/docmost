import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_SALT = 'docmost.secret.encryption';

function deriveKey(appSecret: string): Buffer {
  return scryptSync(appSecret, KEY_SALT, 32);
}

/**
 * Encrypts a string with AES-256-GCM using a key derived from APP_SECRET.
 * Returns base64 of iv || authTag || ciphertext.
 */
export function encryptSecret(plaintext: string, appSecret: string): string {
  const key = deriveKey(appSecret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a payload produced by encryptSecret.
 */
export function decryptSecret(payload: string, appSecret: string): string {
  const key = deriveKey(appSecret);
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}
