/** The supplied password did not unwrap the section key. */
export class WrongPasswordError extends Error {
  constructor(message = "Wrong password") {
    super(message);
    this.name = "WrongPasswordError";
  }
}

/**
 * The stored bytes are not a well-formed encrypted blob at all — invalid
 * base64, too short to hold an IV, or an unrecognised container format. This
 * is a data-integrity problem, not a wrong password, and retyping the password
 * will not help.
 */
export class MalformedEncryptedDataError extends Error {
  constructor(message = "Encrypted data is malformed") {
    super(message);
    this.name = "MalformedEncryptedDataError";
  }
}

/**
 * The blob is well-formed but failed AES-GCM authentication under this key.
 * Either the ciphertext was tampered with, or it belongs to a different
 * encrypted section than the one the key opens.
 */
export class DecryptionFailedError extends Error {
  constructor(message = "Could not decrypt this content") {
    super(message);
    this.name = "DecryptionFailedError";
  }
}

/**
 * The section's encryption metadata names parameters this client refuses to
 * use — an unknown cipher or KDF, or a work factor outside the accepted range.
 * Guards against a hostile server handing out weakened parameters (a KDF
 * downgrade) or absurd ones (a denial of service).
 */
export class UnsupportedEncryptionMetaError extends Error {
  constructor(message = "Unsupported encryption settings") {
    super(message);
    this.name = "UnsupportedEncryptionMetaError";
  }
}

/**
 * The server rejects moves that would change which key a page is encrypted
 * with, tagging each refusal with a code so the UI can explain what to do
 * about it. See assertEncryptionMoveAllowed on the server.
 */
export type EncryptionErrorCode =
  | "ENCRYPTION_REQUIRED"
  | "ENCRYPTED_PAGE_MOVE_OUT"
  | "ENCRYPTED_SECTION_NESTING"
  | "ENCRYPTED_SECTION_PARTIAL_MOVE";

export function getEncryptionErrorCode(
  err: any,
): EncryptionErrorCode | undefined {
  return err?.response?.data?.code;
}

type TranslateFn = (key: string) => string;

/**
 * The wording for each refusal, shared by the tree's own pre-flight check and
 * by the server's rejections — the user sees the same sentence whether the
 * client caught the move or the server did.
 */
export function encryptionMessageForCode(
  code: EncryptionErrorCode,
  t: TranslateFn,
): string {
  switch (code) {
    case "ENCRYPTION_REQUIRED":
      return t("Unlock the encrypted section before moving pages into it.");
    case "ENCRYPTED_PAGE_MOVE_OUT":
      return t(
        "Remove encryption from this page before moving it out of its encrypted section.",
      );
    case "ENCRYPTED_SECTION_NESTING":
      return t("An encrypted section cannot be nested inside another one.");
    case "ENCRYPTED_SECTION_PARTIAL_MOVE":
      return t(
        "This encrypted section contains pages you cannot access, so it cannot be moved.",
      );
  }
}

export function getEncryptionErrorMessage(
  err: any,
  t: TranslateFn,
  fallback?: string,
): string {
  const code = getEncryptionErrorCode(err);
  if (code) return encryptionMessageForCode(code, t);
  // Uncoded server rejections carry their explanation in the response body —
  // the conversion staleness 409s ("This section changed while it was being
  // encrypted...") for instance. Axios's own err.message is just the status
  // line, so prefer what the server actually said.
  const serverMessage = err?.response?.data?.message;
  if (typeof serverMessage === "string" && serverMessage) return serverMessage;
  return fallback ?? err?.message ?? t("Something went wrong");
}
