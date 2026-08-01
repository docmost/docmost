import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import {
  DecryptionFailedError,
  MalformedEncryptedDataError,
  UnsupportedEncryptionMetaError,
  WrongPasswordError,
} from "@/features/encryption/services/encryption-errors";

export const PBKDF2_ITERATIONS = 600_000;

const ENCRYPTION_ALGO = "AES-256-GCM";
const ENCRYPTION_KDF = "PBKDF2-SHA256";
const META_VERSION = 1;
const DEK_CHECK_PLAINTEXT = "docmost-e2ee-check";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const DEK_LENGTH = 32;
/** IV + the wrapped 256-bit key + the GCM tag */
const MIN_WRAPPED_DEK_LENGTH = IV_LENGTH + DEK_LENGTH + GCM_TAG_LENGTH;

// Work-factor bounds enforced on metadata that comes back from the server.
// The floor keeps a hostile or buggy server from handing out a cheap-to-crack
// wrapped DEK (it already holds the ciphertext, so a downgrade hands it an
// offline attack); the ceiling keeps one from freezing the browser.
const MIN_ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;

const BASE64_CHUNK = 0x8000;

export function toBase64(bytes: Uint8Array): string {
  // chunked: one String.fromCharCode per byte builds a quadratic-cost string
  // on documents of any size, and spreading a large array blows the call stack
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + BASE64_CHUNK),
    );
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new MalformedEncryptedDataError();
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Associated data
//
// AES-GCM authenticates, but does not hide, the "associated data" passed
// alongside the ciphertext: decryption fails unless the reader supplies the
// exact same bytes the writer did. Binding every blob to the section it
// belongs to stops a malicious server from moving ciphertext it cannot read
// between contexts — feeding a page from one encrypted section to a reader
// who has a different section unlocked, or replaying a live relay frame as a
// stored document.
//
// Binding is to the *section*, not the page: the server duplicates encrypted
// pages by copying ciphertext to a new page id within the same section, and a
// page-bound tag would make legitimate duplicates undecryptable. Blobs are
// therefore interchangeable within one section (a page and its own history
// snapshots are the same ciphertext by design — the server copies the buffer).
// ---------------------------------------------------------------------------

const AAD_PREFIX = "docmost-e2ee-aad:1:";

// Relay scopes carry the frame type as well: the type field on a relay
// message is plaintext chosen by the server, so without it in the tag the
// server could replay, say, an awareness frame as a document update and doc
// integrity would rest on the Yjs decoder rejecting the bytes rather than on
// authentication.
export type AadScope =
  | "content"
  | "relay:update"
  | "relay:sync-request"
  | "relay:sync-response"
  | "relay:sync-response-sv"
  | "relay:awareness";

/** Associated data for a stored page/history blob or a live relay frame. */
export function sectionAad(
  sectionId: string,
  scope: AadScope = "content",
): Uint8Array {
  return new TextEncoder().encode(`${AAD_PREFIX}${scope}:${sectionId}`);
}

// The wrapped DEK and its check value travel with the section metadata and
// are rewritten wholesale on password change, so they carry a fixed context
// rather than a section id (which is not yet known when a brand-new page is
// encrypted as part of its own creation).
const WRAPPED_DEK_AAD = new TextEncoder().encode(`${AAD_PREFIX}wrapped-dek`);
const DEK_CHECK_AAD = new TextEncoder().encode(`${AAD_PREFIX}dek-check`);

async function deriveKek(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    // NFKC first: the same password typed on a different keyboard or IME can
    // arrive as a different byte sequence for identical-looking text (a
    // precomposed é versus e + combining accent), which would derive a
    // different key and read as a wrong password. Normalising makes the
    // derivation depend on what the user typed, not on how it was encoded.
    new TextEncoder().encode(password.normalize("NFKC")),
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
  aad?: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, ...(aad ? { additionalData: aad } : {}) },
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
  aad?: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (blob.length <= IV_LENGTH) {
    throw new MalformedEncryptedDataError();
  }
  const iv = blob.slice(0, IV_LENGTH);
  const ciphertext = blob.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, ...(aad ? { additionalData: aad } : {}) },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

async function importDek(
  rawDek: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  // Non-extractable: the key lives only in the in-memory page key store, and
  // nothing needs its bytes back. Changing the password re-derives the raw DEK
  // from the current password instead of exporting this handle, so script
  // running in the page cannot lift key material out of the vault.
  return crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM" }, false, [
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
  const wrappedDek = await encryptWithKey(kek, rawDek, WRAPPED_DEK_AAD);

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
    DEK_CHECK_AAD,
  );
  return toBase64(check);
}

/**
 * Reject metadata naming primitives or a work factor this client will not use,
 * before spending any time on it. See MIN_ITERATIONS.
 */
function assertSupportedMeta(meta: EncryptionMeta): void {
  if (meta.algo !== ENCRYPTION_ALGO || meta.kdf !== ENCRYPTION_KDF) {
    throw new UnsupportedEncryptionMetaError();
  }
  if (
    !Number.isInteger(meta.iterations) ||
    meta.iterations < MIN_ITERATIONS ||
    meta.iterations > MAX_ITERATIONS
  ) {
    throw new UnsupportedEncryptionMetaError();
  }
  if (meta.version !== undefined && meta.version > META_VERSION) {
    throw new UnsupportedEncryptionMetaError();
  }

  // Clamping the work factor alone is not enough: a short or shared salt makes
  // the derivation cheap to attack across sections however many iterations it
  // runs, and truncated key material would fail later in a way that reads as a
  // wrong password rather than as metadata the server should not have served.
  if (fromBase64(meta.salt).length < SALT_LENGTH) {
    throw new UnsupportedEncryptionMetaError();
  }
  if (fromBase64(meta.wrappedDek).length < MIN_WRAPPED_DEK_LENGTH) {
    throw new UnsupportedEncryptionMetaError();
  }
  if (fromBase64(meta.dekCheck).length <= IV_LENGTH + GCM_TAG_LENGTH) {
    throw new UnsupportedEncryptionMetaError();
  }
}

function buildMeta(
  wrapped: Pick<EncryptionMeta, "salt" | "wrappedDek" | "iterations">,
  dekCheck: string,
): EncryptionMeta {
  return {
    version: META_VERSION,
    algo: ENCRYPTION_ALGO,
    kdf: ENCRYPTION_KDF,
    iterations: wrapped.iterations,
    salt: wrapped.salt,
    wrappedDek: wrapped.wrappedDek,
    dekCheck,
  };
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

  try {
    const dek = await importDek(rawDek);
    const wrapped = await wrapDek(rawDek, password);
    const dekCheck = await createDekCheck(dek);
    return { meta: buildMeta(wrapped, dekCheck), dek };
  } finally {
    rawDek.fill(0);
  }
}

/**
 * Derive the section key from a password. The caller gets back an opaque,
 * non-extractable handle; raw key bytes never outlive this function.
 */
export async function unlockDek(
  password: string,
  meta: EncryptionMeta,
): Promise<CryptoKey> {
  assertSupportedMeta(meta);
  const { dek, rawDek } = await unlockRawDek(password, meta);
  rawDek.fill(0);
  return dek;
}

async function unlockRawDek(
  password: string,
  meta: EncryptionMeta,
): Promise<{ dek: CryptoKey; rawDek: Uint8Array<ArrayBuffer> }> {
  const salt = fromBase64(meta.salt);
  const wrappedDek = fromBase64(meta.wrappedDek);
  const dekCheckBlob = fromBase64(meta.dekCheck);

  const kek = await deriveKek(password, salt, meta.iterations);

  // Only a failure to unwrap means "wrong password" — malformed input already
  // threw above, and anything after this point is a data problem worth
  // reporting as such rather than sending the user back to retype a password
  // that was in fact correct.
  let rawDek: Uint8Array<ArrayBuffer>;
  try {
    rawDek = await decryptWithKey(kek, wrappedDek, WRAPPED_DEK_AAD);
  } catch (err) {
    if (err instanceof MalformedEncryptedDataError) throw err;
    throw new WrongPasswordError();
  }

  try {
    const dek = await importDek(rawDek);
    const check = await decryptWithKey(dek, dekCheckBlob, DEK_CHECK_AAD);
    if (new TextDecoder().decode(check) !== DEK_CHECK_PLAINTEXT) {
      throw new DecryptionFailedError("Section key check failed");
    }
    return { dek, rawDek };
  } catch (err) {
    rawDek.fill(0);
    if (
      err instanceof MalformedEncryptedDataError ||
      err instanceof DecryptionFailedError
    ) {
      throw err;
    }
    // the DEK unwrapped but does not open its own check value: the metadata is
    // internally inconsistent, not a password the user can correct
    throw new DecryptionFailedError("Section key check failed");
  }
}

export async function encryptBytes(
  dek: CryptoKey,
  bytes: Uint8Array,
  aad: Uint8Array,
): Promise<string> {
  return toBase64(await encryptWithKey(dek, bytes as BufferSource, aad));
}

/**
 * Decrypt a stored blob or relay frame, with no tolerance for a missing or
 * mismatched context tag: nothing this feature has ever shipped writes
 * untagged ciphertext, so an untagged blob can only be ciphertext minted for
 * another purpose — exactly what the tag exists to reject.
 */
export async function decryptBytes(
  dek: CryptoKey,
  blobBase64: string,
  aad: Uint8Array,
): Promise<Uint8Array> {
  try {
    return await decryptWithKey(dek, fromBase64(blobBase64), aad);
  } catch (err) {
    if (err instanceof MalformedEncryptedDataError) throw err;
    throw new DecryptionFailedError();
  }
}

/** Live relay frames go through the same strict path as stored blobs. */
export const decryptRelayFrame = decryptBytes;

/**
 * Re-wrap the section key under a new password.
 *
 * Takes the current password rather than the unlocked key handle: the DEK is
 * non-extractable, so its bytes are recovered by deriving them again. This
 * also means a password change requires proving knowledge of the old one.
 */
export async function rewrapDek(
  currentPassword: string,
  meta: EncryptionMeta,
  newPassword: string,
): Promise<EncryptionMeta> {
  assertSupportedMeta(meta);
  const { dek, rawDek } = await unlockRawDek(currentPassword, meta);
  try {
    const wrapped = await wrapDek(rawDek, newPassword);
    const dekCheck = await createDekCheck(dek);
    return buildMeta(wrapped, dekCheck);
  } finally {
    rawDek.fill(0);
  }
}
