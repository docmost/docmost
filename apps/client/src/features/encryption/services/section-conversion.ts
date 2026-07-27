import { encryptBytes } from "@/features/encryption/services/crypto";
import { decryptBlobToProsemirrorJSON } from "@/features/encryption/services/encrypted-blob";
import {
  convertPageToEncrypted,
  decryptPageToPlaintext,
  getEncryptionSection,
} from "@/features/encryption/services/encryption-service";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import { registerPageSections } from "@/features/encryption/hooks/page-key-store";

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** blobs are written in the v1 (utf8 prosemirror JSON) format, as the
 * single-page conversion does; the editor migrates them to v2 on first save */
export function encodeJsonBlob(content: any): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(content ?? EMPTY_DOC));
}

/**
 * Encrypt a page and every page nested under it with one DEK. The whole
 * subtree is converted in a single server call, so either all of it becomes
 * encrypted or none of it does.
 *
 * `rootContent` overrides the server's copy of the root page's content — the
 * live editor state is fresher than what the server has when the user
 * encrypts a page they are editing.
 */
export async function encryptSection(options: {
  pageId: string;
  dek: CryptoKey;
  /** starts a new section — omit when joining one */
  meta?: EncryptionMeta;
  /** joins the section keyed to this page, moving the subtree into it */
  joinRootId?: string;
  move?: { parentPageId: string; position: string };
  rootContent?: any;
}): Promise<{ pageCount: number }> {
  const { pageId, dek, meta, joinRootId, move, rootContent } = options;

  const section = await getEncryptionSection(pageId);
  if (section.kind !== "plaintext") {
    throw new Error("This section is already encrypted");
  }

  let rootBlob: string | null = null;
  const descendants: { pageId: string; encryptedBlob: string }[] = [];

  for (const page of section.pages) {
    const isRoot = page.pageId === pageId;
    const content = isRoot ? (rootContent ?? page.content) : page.content;
    const encryptedBlob = await encryptBytes(dek, encodeJsonBlob(content));

    if (isRoot) {
      rootBlob = encryptedBlob;
    } else {
      descendants.push({ pageId: page.pageId, encryptedBlob });
    }
  }

  if (!rootBlob) {
    throw new Error("The page to encrypt is missing from its own section");
  }

  await convertPageToEncrypted({
    pageId,
    encryptionMeta: meta,
    encryptionRootId: joinRootId,
    move,
    encryptedBlob: rootBlob,
    descendants,
  });

  // the vault entry lives under the section root; point every page at it so
  // they read as unlocked without waiting for a tree refetch
  const sectionRootId = joinRootId ?? pageId;
  registerPageSections(
    section.pages.map((page) => ({
      pageId: page.pageId,
      encryptionRootId: page.pageId === sectionRootId ? null : sectionRootId,
    })),
  );

  return { pageCount: section.pages.length };
}

/**
 * Decrypt an encrypted section back to plaintext pages. Every page keyed to
 * the root is decrypted: leaving one behind would strand it with no reachable
 * key.
 */
export async function decryptSection(options: {
  pageId: string;
  dek: CryptoKey;
  rootContent?: any;
}): Promise<{ pageCount: number }> {
  const { pageId, dek, rootContent } = options;

  const section = await getEncryptionSection(pageId);
  if (section.kind !== "encrypted") {
    throw new Error("This section is not encrypted");
  }

  let rootJson: any = null;
  const descendants: { pageId: string; content: any }[] = [];

  for (const page of section.pages) {
    const isRoot = page.pageId === pageId;

    let content: any;
    if (isRoot && rootContent) {
      content = rootContent;
    } else if (page.encryptedBlob) {
      content = await decryptBlobToProsemirrorJSON(dek, page.encryptedBlob);
    } else {
      content = EMPTY_DOC;
    }

    if (isRoot) {
      rootJson = content;
    } else {
      descendants.push({ pageId: page.pageId, content });
    }
  }

  if (!rootJson) {
    throw new Error("The page to decrypt is missing from its own section");
  }

  await decryptPageToPlaintext({
    pageId,
    content: rootJson,
    descendants,
  });

  registerPageSections(
    section.pages.map((page) => ({
      pageId: page.pageId,
      encryptionRootId: null,
    })),
  );

  return { pageCount: section.pages.length };
}
