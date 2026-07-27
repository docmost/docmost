/**
 * An encrypted subtree shares one DEK. The root page stores the wrapped key
 * (encryption_meta); every other page in the section points at it through
 * encryption_root_id. Plain pages and encryption roots both have a null
 * encryption_root_id, so "which key opens this page" is resolved here rather
 * than read off the column directly.
 */
export function encryptionRootIdOf(page: {
  id: string;
  isEncrypted: boolean;
  encryptionRootId?: string | null;
}): string | null {
  if (!page.isEncrypted) return null;
  return page.encryptionRootId ?? page.id;
}
