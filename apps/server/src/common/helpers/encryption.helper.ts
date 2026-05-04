import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM symmetric encryption keyed off a caller-supplied secret (e.g.
 * `APP_SECRET`). Used for at-rest encryption of OAuth refresh + access tokens
 * so a snapshot of the database alone can't impersonate users against
 * third-party providers.
 *
 * The wire format is `v1:<iv>:<tag>:<ciphertext>` (all hex). The `v1:` prefix
 * leaves room to rotate KDF or cipher choice without a destructive migration.
 *
 * `info` is mixed into HKDF to domain-separate this key from any other use of
 * the same secret (HMAC email signatures, JWT signing). Callers should pick a
 * stable info string per use case and never reuse it for a different purpose.
 */

const VERSION = 'v1';
const KEY_LENGTH = 32; // 256 bits for AES-256-GCM
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

const HKDF_SALT = Buffer.alloc(0); // empty salt is fine when info is unique per use case

function deriveKey(secret: string, info: string): Buffer {
  if (!secret) {
    throw new Error('encryption: secret is required');
  }
  const out = hkdfSync('sha256', Buffer.from(secret), HKDF_SALT, info, KEY_LENGTH);
  return Buffer.from(out);
}

export function encryptString(plaintext: string, secret: string, info: string): string {
  const key = deriveKey(secret, info);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptString(blob: string, secret: string, info: string): string {
  if (!blob) {
    throw new Error('encryption: ciphertext is empty');
  }
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(`encryption: unrecognized blob format (expected ${VERSION}:iv:tag:ct)`);
  }
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const ciphertext = Buffer.from(parts[3], 'hex');
  if (iv.length !== IV_LENGTH) {
    throw new Error(`encryption: invalid iv length`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`encryption: invalid auth tag length`);
  }

  const key = deriveKey(secret, info);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
