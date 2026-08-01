/**
 * Which pages currently open in this tab are end-to-end encrypted.
 *
 * Attachments are stored as uploaded, outside the encryption — so a file added
 * to an encrypted page would publish content the page implies is protected.
 * Refusing that has to happen at the point of upload rather than per entry
 * point: the editor offers files through the slash menu, the media toolbars,
 * paste, drop and drag handles, and a guard on any one of those is a guard on
 * none of the others.
 *
 * Registered by the encrypted editor, which is mounted exactly when a page is
 * encrypted and knows it definitively.
 */
const encryptedPageIds = new Set<string>();

export function markPageEncrypted(pageId: string): void {
  encryptedPageIds.add(pageId);
}

export function unmarkPageEncrypted(pageId: string): void {
  encryptedPageIds.delete(pageId);
}

export function isPageEncrypted(pageId: string): boolean {
  return encryptedPageIds.has(pageId);
}

/** Thrown instead of uploading a file that would be stored unencrypted. */
export class EncryptedPageUploadError extends Error {
  constructor(message = "Files cannot be added to encrypted pages.") {
    super(message);
    this.name = "EncryptedPageUploadError";
  }
}
