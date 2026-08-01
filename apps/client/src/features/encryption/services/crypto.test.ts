import { describe, expect, it } from "vitest";
import {
  createEncryptionMeta,
  decryptBytes,
  decryptRelayFrame,
  encryptBytes,
  fromBase64,
  PBKDF2_ITERATIONS,
  rewrapDek,
  sectionAad,
  toBase64,
  unlockDek,
} from "@/features/encryption/services/crypto";
import {
  DecryptionFailedError,
  MalformedEncryptedDataError,
  UnsupportedEncryptionMetaError,
  WrongPasswordError,
} from "@/features/encryption/services/encryption-errors";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";

const PASSWORD = "correct horse battery staple";
const SECTION = "11111111-1111-4111-8111-111111111111";
const OTHER_SECTION = "22222222-2222-4222-8222-222222222222";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (buf: Uint8Array) => new TextDecoder().decode(buf);

/** AES-GCM with no associated data — what a pre-tagging client produced */
async function encryptUntagged(
  dek: CryptoKey,
  plaintext: Uint8Array,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    plaintext as BufferSource,
  );
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(out);
}

// Deriving a key at the real work factor takes roughly a second, so the
// sections used across tests are created once.
let section: { meta: EncryptionMeta; dek: CryptoKey };
async function getSection() {
  section ??= await createEncryptionMeta(PASSWORD);
  return section;
}

describe("toBase64/fromBase64", () => {
  it("round-trips a payload larger than the chunk size", () => {
    // guards the chunked encoder: a single fromCharCode spread over a buffer
    // this size overflows the call stack
    const data = new Uint8Array(200_000);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;
    expect(fromBase64(toBase64(data))).toEqual(data);
  });

  it("reports input that is not base64 as malformed, not as a wrong password", () => {
    expect(() => fromBase64("not valid base64!!")).toThrow(
      MalformedEncryptedDataError,
    );
  });
});

describe("createEncryptionMeta", () => {
  it("names the primitives and work factor it used", async () => {
    const { meta } = await getSection();
    expect(meta.algo).toBe("AES-256-GCM");
    expect(meta.kdf).toBe("PBKDF2-SHA256");
    expect(meta.iterations).toBe(PBKDF2_ITERATIONS);
    expect(meta.version).toBe(1);
  });

  it("uses a fresh salt per section, so identical passwords derive different keys", async () => {
    const a = await createEncryptionMeta("same-password");
    const b = await createEncryptionMeta("same-password");
    expect(a.meta.salt).not.toBe(b.meta.salt);
    expect(a.meta.wrappedDek).not.toBe(b.meta.wrappedDek);
  });

  it("produces a key that cannot be exported back to raw bytes", async () => {
    const { dek } = await getSection();
    expect(dek.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", dek)).rejects.toThrow();
  });
});

describe("unlockDek", () => {
  it("recovers a key that decrypts what the original encrypted", async () => {
    const { meta, dek } = await getSection();
    const blob = await encryptBytes(dek, bytes("hello"), sectionAad(SECTION));

    const unlocked = await unlockDek(PASSWORD, meta);
    expect(text(await decryptBytes(unlocked, blob, sectionAad(SECTION)))).toBe(
      "hello",
    );
  });

  it("rejects a wrong password distinguishably from damaged data", async () => {
    const { meta } = await getSection();
    await expect(unlockDek("wrong password", meta)).rejects.toThrow(
      WrongPasswordError,
    );
  });

  it("reports metadata that is not decodable as malformed", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, { ...meta, wrappedDek: "!!!not base64!!!" }),
    ).rejects.toThrow(MalformedEncryptedDataError);
  });

  // A server that can hand out arbitrary metadata could otherwise weaken the
  // KDF (it already holds the wrapped key, so a downgrade is an offline
  // attack) or stall the browser with an absurd work factor.
  it("refuses a work factor below the floor", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, { ...meta, iterations: 1 }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
  });

  it("refuses a work factor large enough to hang the browser", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, { ...meta, iterations: 5_000_000_000 }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
  });

  it("refuses a cipher or KDF it does not implement", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, { ...meta, algo: "AES-128-CBC" }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
    await expect(
      unlockDek(PASSWORD, { ...meta, kdf: "PBKDF2-MD5" }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
  });

  // A short or shared salt makes the derivation cheap to attack across
  // sections however many iterations it runs, so clamping iterations alone
  // leaves the threat model incomplete.
  it("refuses a salt shorter than the full 16 bytes", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, { ...meta, salt: toBase64(new Uint8Array(8)) }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
  });

  it("refuses key material too short to be a wrapped 256-bit key", async () => {
    const { meta } = await getSection();
    await expect(
      unlockDek(PASSWORD, {
        ...meta,
        wrappedDek: toBase64(new Uint8Array(40)),
      }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
    await expect(
      unlockDek(PASSWORD, { ...meta, dekCheck: toBase64(new Uint8Array(20)) }),
    ).rejects.toThrow(UnsupportedEncryptionMetaError);
  });

  it("refuses metadata from a newer format version", async () => {
    const { meta } = await getSection();
    await expect(unlockDek(PASSWORD, { ...meta, version: 99 })).rejects.toThrow(
      UnsupportedEncryptionMetaError,
    );
  });
});

describe("password normalization", () => {
  it("accepts the same text however it was encoded", async () => {
    // "café" precomposed vs. e + combining acute: identical to the user,
    // different bytes, and without normalization a different derived key
    const precomposed = "café-passphrase";
    const decomposed = "café-passphrase";
    expect(precomposed).not.toBe(decomposed);

    const { meta } = await createEncryptionMeta(precomposed);
    await expect(unlockDek(decomposed, meta)).resolves.toBeDefined();
  });
});

describe("associated data", () => {
  it("does not decrypt a blob belonging to another section", async () => {
    const { dek } = await getSection();
    const blob = await encryptBytes(dek, bytes("secret"), sectionAad(SECTION));

    // the same key, so this fails only because the context tag differs — this
    // is what stops the server moving ciphertext between sections
    await expect(
      decryptBytes(dek, blob, sectionAad(OTHER_SECTION)),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("does not accept a live relay frame as stored page content", async () => {
    const { dek } = await getSection();
    const frame = await encryptBytes(
      dek,
      bytes("update"),
      sectionAad(SECTION, "relay:update"),
    );

    await expect(decryptBytes(dek, frame, sectionAad(SECTION))).rejects.toThrow(
      DecryptionFailedError,
    );
  });

  it("detects a tampered ciphertext", async () => {
    const { dek } = await getSection();
    const blob = await encryptBytes(dek, bytes("secret"), sectionAad(SECTION));

    const raw = fromBase64(blob);
    raw[raw.length - 1] ^= 0xff;

    await expect(
      decryptBytes(dek, toBase64(raw), sectionAad(SECTION)),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("refuses a stored blob written without a context tag", async () => {
    const { dek } = await getSection();
    // Nothing this feature has ever shipped writes untagged ciphertext, so an
    // untagged blob can only be ciphertext minted for another purpose. There
    // is deliberately no fallback that would accept it.
    const untagged = await encryptUntagged(dek, bytes("old content"));

    await expect(
      decryptBytes(dek, untagged, sectionAad(SECTION)),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("refuses an untagged frame on the relay", async () => {
    const { dek } = await getSection();
    const untagged = await encryptUntagged(dek, bytes("injected update"));

    await expect(
      decryptRelayFrame(dek, untagged, sectionAad(SECTION, "relay:update")),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("refuses a stored blob replayed as a relay frame", async () => {
    const { dek } = await getSection();
    const stored = await encryptBytes(dek, bytes("page"), sectionAad(SECTION));

    await expect(
      decryptRelayFrame(dek, stored, sectionAad(SECTION, "relay:update")),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("refuses a relay frame replayed as a different frame type", async () => {
    const { dek } = await getSection();
    // the type field on a relay message is plaintext the server controls;
    // binding it into the tag is what stops an awareness frame from being
    // relabeled as a document update
    const frame = await encryptBytes(
      dek,
      bytes("presence"),
      sectionAad(SECTION, "relay:awareness"),
    );

    await expect(
      decryptRelayFrame(dek, frame, sectionAad(SECTION, "relay:update")),
    ).rejects.toThrow(DecryptionFailedError);
  });

  it("accepts a properly tagged relay frame", async () => {
    const { dek } = await getSection();
    const frame = await encryptBytes(
      dek,
      bytes("update"),
      sectionAad(SECTION, "relay:update"),
    );

    expect(
      text(await decryptRelayFrame(dek, frame, sectionAad(SECTION, "relay:update"))),
    ).toBe("update");
  });

  it("rejects a blob too short to hold an IV as malformed", async () => {
    const { dek } = await getSection();
    await expect(
      decryptBytes(dek, toBase64(new Uint8Array(4)), sectionAad(SECTION)),
    ).rejects.toThrow(MalformedEncryptedDataError);
  });
});

describe("rewrapDek", () => {
  it("keeps the content readable under the new password", async () => {
    const { meta, dek } = await createEncryptionMeta("first-password");
    const blob = await encryptBytes(dek, bytes("payload"), sectionAad(SECTION));

    const newMeta = await rewrapDek("first-password", meta, "second-password");
    const unlocked = await unlockDek("second-password", newMeta);

    expect(text(await decryptBytes(unlocked, blob, sectionAad(SECTION)))).toBe(
      "payload",
    );
  });

  it("makes the old password stop working", async () => {
    const { meta } = await createEncryptionMeta("first-password");
    const newMeta = await rewrapDek("first-password", meta, "second-password");

    await expect(unlockDek("first-password", newMeta)).rejects.toThrow(
      WrongPasswordError,
    );
  });

  it("requires the current password, so an unlocked tab alone cannot change it", async () => {
    const { meta } = await createEncryptionMeta("first-password");
    await expect(
      rewrapDek("not-the-password", meta, "second-password"),
    ).rejects.toThrow(WrongPasswordError);
  });
});
