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
  return fallback ?? err?.message ?? t("Something went wrong");
}
