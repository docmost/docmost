import * as crypto from 'crypto';

function deriveEncryptionKey(appSecret: string): Buffer {
  return crypto.createHash('sha256').update(appSecret).digest();
}

export function encryptToken(token: string, appSecret: string): string {
  const algorithm = 'aes-256-gcm';
  const key = deriveEncryptionKey(appSecret);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptToken(encryptedToken: string, appSecret: string): string {
  const algorithm = 'aes-256-gcm';
  const key = deriveEncryptionKey(appSecret);

  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
