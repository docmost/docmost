import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc } from "y-prosemirror";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import {
  encryptBytes,
  sectionAad,
} from "@/features/encryption/services/crypto";
import {
  decryptBlobToProsemirrorJSON,
  encodeYdocBlob,
} from "@/features/encryption/services/encrypted-blob";
import {
  convertPageToEncrypted,
  decryptPageToPlaintext,
  getEncryptionSection,
} from "@/features/encryption/services/encryption-service";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import { registerPageSections } from "@/features/encryption/hooks/page-key-store";

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

let cachedSchema: ReturnType<typeof getSchema> | null = null;

/**
 * Encode page content as a v2 blob: a Yjs document in its full state.
 *
 * Conversion writes v2 directly rather than plain JSON so a freshly encrypted
 * page can join the collaboration relay immediately. A v1 blob has no Yjs
 * state to sync from, so each client would have to seed its own document and
 * two editors opening the page at once would conflict irreconcilably.
 */
export function contentToYdocBlob(content: any): Uint8Array {
  cachedSchema ??= getSchema(mainExtensions);
  const doc = prosemirrorJSONToYDoc(cachedSchema, content ?? EMPTY_DOC, "default");
  const bytes = encodeYdocBlob(doc);
  doc.destroy();
  return bytes;
}

/**
 * Encrypt a page and every page nested under it with one DEK. The whole
 * subtree is converted in a single server call, so either all of it becomes
 * encrypted or none of it does.
 *
 * `getRootContent` overrides the server's copy of the root page's content
 * with live editor state — fresher than what the server has when the user
 * encrypts a page they are editing. It is a thunk, sampled only after the
 * manifest fetch: the manifest's updatedAt is the staleness token the server
 * verifies, so content captured before it could lag the very snapshot the
 * token vouches for and overwrite newer edits without tripping the check.
 */
export async function encryptSection(options: {
  pageId: string;
  dek: CryptoKey;
  /** starts a new section — omit when joining one */
  meta?: EncryptionMeta;
  /** joins the section keyed to this page, moving the subtree into it */
  joinRootId?: string;
  move?: { parentPageId: string; position: string };
  getRootContent?: () => any;
}): Promise<{ pageCount: number }> {
  const { pageId, dek, meta, joinRootId, move, getRootContent } = options;

  const section = await getEncryptionSection(pageId);
  if (section.kind !== "plaintext") {
    throw new Error("This section is already encrypted");
  }
  const rootContent = getRootContent?.();

  let rootBlob: string | null = null;
  let rootSnapshotUpdatedAt: string | null = null;
  const descendants: {
    pageId: string;
    encryptedBlob: string;
    snapshotUpdatedAt: string;
  }[] = [];

  // every blob in the section is bound to the section it lives in
  const sectionRootId = joinRootId ?? pageId;
  const aad = sectionAad(sectionRootId);

  for (const page of section.pages) {
    const isRoot = page.pageId === pageId;
    const content = isRoot ? (rootContent ?? page.content) : page.content;
    const encryptedBlob = await encryptBytes(
      dek,
      contentToYdocBlob(content),
      aad,
    );

    if (isRoot) {
      rootBlob = encryptedBlob;
      rootSnapshotUpdatedAt = page.updatedAt;
    } else {
      descendants.push({
        pageId: page.pageId,
        encryptedBlob,
        snapshotUpdatedAt: page.updatedAt,
      });
    }
  }

  if (!rootBlob) {
    throw new Error("The page to encrypt is missing from its own section");
  }

  // Every path into here goes through a modal or confirmation that spells out
  // what encrypting discards (history, comments, shares, backlinks, attachments)
  // — the server refuses the conversion without this acknowledgement.
  await convertPageToEncrypted({
    pageId,
    encryptionMeta: meta,
    encryptionRootId: joinRootId,
    move,
    encryptedBlob: rootBlob,
    snapshotUpdatedAt: rootSnapshotUpdatedAt,
    descendants,
    acknowledgeDataDeletion: true,
  });

  // the vault entry lives under the section root; point every page at it so
  // they read as unlocked without waiting for a tree refetch
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
  /** the encryption root whose key opens these blobs (the page when self-rooted) */
  sectionId: string;
  dek: CryptoKey;
  /** sampled after the manifest fetch; see encryptSection */
  getRootContent?: () => any;
}): Promise<{ pageCount: number }> {
  const { pageId, sectionId, dek, getRootContent } = options;

  const section = await getEncryptionSection(pageId);
  if (section.kind !== "encrypted") {
    throw new Error("This section is not encrypted");
  }
  const rootContent = getRootContent?.();

  const aad = sectionAad(sectionId);

  let rootJson: any = null;
  let rootBaseVersion: number | null = null;
  const descendants: { pageId: string; content: any; baseVersion: number }[] =
    [];

  for (const page of section.pages) {
    const isRoot = page.pageId === pageId;

    let content: any;
    if (isRoot && rootContent) {
      content = rootContent;
    } else if (page.encryptedBlob) {
      content = await decryptBlobToProsemirrorJSON(dek, page.encryptedBlob, aad);
    } else {
      content = EMPTY_DOC;
    }

    if (isRoot) {
      rootJson = content;
      rootBaseVersion = page.version;
    } else {
      descendants.push({
        pageId: page.pageId,
        content,
        baseVersion: page.version,
      });
    }
  }

  if (!rootJson) {
    throw new Error("The page to decrypt is missing from its own section");
  }

  // the menu confirms this destructively and irreversibly replaces the
  // ciphertext and drops the encrypted history before calling
  await decryptPageToPlaintext({
    pageId,
    content: rootJson,
    baseVersion: rootBaseVersion,
    descendants,
    acknowledgeDataDeletion: true,
  });

  registerPageSections(
    section.pages.map((page) => ({
      pageId: page.pageId,
      encryptionRootId: null,
    })),
  );

  return { pageCount: section.pages.length };
}
