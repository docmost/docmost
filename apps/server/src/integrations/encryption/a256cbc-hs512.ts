import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

export const V2_ALGORITHM = 'A256CBC-HS512';
export const V2_KEY_LENGTH = 64;
export const V2_IV_LENGTH = 16;
export const V2_TAG_LENGTH = 32;

type AuthenticatedCiphertext = {
  iv: Buffer;
  authTag: Buffer;
  cipherText: Buffer;
};

function validateKeyAndIv(key: Buffer, iv: Buffer): void {
  if (key.length !== V2_KEY_LENGTH || iv.length !== V2_IV_LENGTH) {
    throw new Error('Invalid A256CBC-HS512 key or IV length.');
  }
}

// RFC 7518 §5.2: MAC_KEY precedes ENC_KEY; AL is the AAD length in bits.
function authenticationTag(
  key: Buffer,
  aad: Buffer,
  iv: Buffer,
  cipherText: Buffer,
): Buffer {
  const aadLength = Buffer.alloc(8);
  aadLength.writeBigUInt64BE(BigInt(aad.length) * 8n);
  return createHmac('sha512', key.subarray(0, 32))
    .update(aad)
    .update(iv)
    .update(cipherText)
    .update(aadLength)
    .digest()
    .subarray(0, V2_TAG_LENGTH);
}

export function encryptA256CbcHs512(
  plaintext: Buffer,
  key: Buffer,
  iv: Buffer,
  aad: Buffer,
): AuthenticatedCiphertext {
  validateKeyAndIv(key, iv);
  const cipher = createCipheriv('aes-256-cbc', key.subarray(32), iv);
  const cipherText = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv,
    cipherText,
    authTag: authenticationTag(key, aad, iv, cipherText),
  };
}

export function decryptA256CbcHs512(
  payload: AuthenticatedCiphertext,
  key: Buffer,
  aad: Buffer,
): Buffer {
  const { iv, authTag, cipherText } = payload;
  validateKeyAndIv(key, iv);
  if (
    authTag.length !== V2_TAG_LENGTH ||
    cipherText.length === 0 ||
    cipherText.length % V2_IV_LENGTH !== 0
  ) {
    throw new Error('Invalid A256CBC-HS512 payload lengths.');
  }

  const expected = authenticationTag(key, aad, iv, cipherText);
  if (!timingSafeEqual(authTag, expected)) {
    throw new Error('Ciphertext authentication failed.');
  }

  // Authenticate before invoking CBC decryption or inspecting its padding.
  const decipher = createDecipheriv('aes-256-cbc', key.subarray(32), iv);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]);
}
