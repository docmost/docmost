import {
  EncryptionMeta,
  WrongPasswordError,
} from "@/features/encryption/types/encryption.types";

export const PBKDF2_ITERATIONS = 600_000;

const ENCRYPTION_ALGO = "AES-256-GCM";
const ENCRYPTION_KDF = "PBKDF2-SHA256";
const DEK_CHECK_PLAINTEXT = "docmost-e2ee-check";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKek(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptWithKey(
  key: CryptoKey,
  bytes: BufferSource,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes,
  );

  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);
  return result;
}

async function decryptWithKey(
  key: CryptoKey,
  blob: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = blob.slice(0, IV_LENGTH);
  const ciphertext = blob.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

async function importDek(rawDek: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  // Imported as extractable so the DEK can be rewrapped on password change.
  // The key only ever lives in memory (page key store) and is never persisted.
  return crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function wrapDek(
  rawDek: Uint8Array<ArrayBuffer>,
  password: string,
): Promise<Pick<EncryptionMeta, "salt" | "wrappedDek" | "iterations">> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS);
  const wrappedDek = await encryptWithKey(kek, rawDek);

  return {
    salt: toBase64(salt),
    wrappedDek: toBase64(wrappedDek),
    iterations: PBKDF2_ITERATIONS,
  };
}

async function createDekCheck(dek: CryptoKey): Promise<string> {
  const check = await encryptWithKey(
    dek,
    new TextEncoder().encode(DEK_CHECK_PLAINTEXT),
  );
  return toBase64(check);
}

export async function createEncryptionMeta(
  password: string,
): Promise<{ meta: EncryptionMeta; dek: CryptoKey }> {
  const generatedDek = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const rawDek = new Uint8Array(
    await crypto.subtle.exportKey("raw", generatedDek),
  );

  const dek = await importDek(rawDek);
  const { salt, wrappedDek, iterations } = await wrapDek(rawDek, password);
  const dekCheck = await createDekCheck(dek);

  return {
    meta: {
      algo: ENCRYPTION_ALGO,
      kdf: ENCRYPTION_KDF,
      iterations,
      salt,
      wrappedDek,
      dekCheck,
    },
    dek,
  };
}

export async function unlockDek(
  password: string,
  meta: EncryptionMeta,
): Promise<CryptoKey> {
  try {
    const kek = await deriveKek(
      password,
      fromBase64(meta.salt),
      meta.iterations,
    );
    const rawDek = await decryptWithKey(kek, fromBase64(meta.wrappedDek));
    const dek = await importDek(rawDek);

    const check = await decryptWithKey(dek, fromBase64(meta.dekCheck));
    if (new TextDecoder().decode(check) !== DEK_CHECK_PLAINTEXT) {
      throw new Error("DEK check mismatch");
    }

    return dek;
  } catch (err) {
    throw new WrongPasswordError();
  }
}

export async function encryptBytes(
  dek: CryptoKey,
  bytes: Uint8Array,
): Promise<string> {
  return toBase64(await encryptWithKey(dek, bytes as BufferSource));
}

export async function decryptBytes(
  dek: CryptoKey,
  blobBase64: string,
): Promise<Uint8Array> {
  return decryptWithKey(dek, fromBase64(blobBase64));
}

export async function rewrapDek(
  dek: CryptoKey,
  newPassword: string,
): Promise<EncryptionMeta> {
  const rawDek = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  const { salt, wrappedDek, iterations } = await wrapDek(rawDek, newPassword);
  const dekCheck = await createDekCheck(dek);

  return {
    algo: ENCRYPTION_ALGO,
    kdf: ENCRYPTION_KDF,
    iterations,
    salt,
    wrappedDek,
    dekCheck,
  };
}
