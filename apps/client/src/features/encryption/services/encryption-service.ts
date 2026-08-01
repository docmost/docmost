import api from "@/lib/api-client";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";
import { registerPageSection } from "@/features/encryption/hooks/page-key-store";

export interface IEncryptedBlobResponse {
  pageId: string;
  /** the page holding the wrapped DEK — the page itself when self-rooted */
  encryptionRootId: string | null;
  encryptionMeta: EncryptionMeta;
  encryptedBlob: string | null;
  version: number;
}

/** one page of an encrypted section, as returned by the section manifest */
export interface IEncryptedSectionPage {
  pageId: string;
  title: string | null;
  encryptedBlob: string | null;
  version: number;
}

/** one page of a plaintext section, as returned by the section manifest */
export interface IPlaintextSectionPage {
  pageId: string;
  title: string | null;
  content: any;
  /** echoed back on convert so the server can refuse a stale snapshot */
  updatedAt: string;
}

// string discriminant, not a boolean: this project compiles with
// strictNullChecks off, where narrowing on a `false` literal is unreliable
export type IEncryptionSection =
  | { kind: "plaintext"; pages: IPlaintextSectionPage[] }
  | { kind: "encrypted"; pages: IEncryptedSectionPage[] };

export async function getEncryptedBlob(
  pageId: string,
): Promise<IEncryptedBlobResponse> {
  const req = await api.post<IEncryptedBlobResponse>("/pages/encryption/blob", {
    pageId,
  });
  registerPageSection(req.data.pageId, req.data.encryptionRootId);
  return req.data;
}

/**
 * Every page that a section conversion has to cover: the plaintext to encrypt,
 * or the ciphertext to decrypt.
 */
export async function getEncryptionSection(
  pageId: string,
): Promise<IEncryptionSection> {
  const req = await api.post<IEncryptionSection>("/pages/encryption/section", {
    pageId,
  });
  return req.data;
}

export async function convertPageToEncrypted(data: {
  pageId: string;
  /** starts a new section; mutually exclusive with encryptionRootId */
  encryptionMeta?: EncryptionMeta;
  /** joins the section keyed to this page; requires `move` */
  encryptionRootId?: string;
  /** applied in the conversion transaction when joining a section */
  move?: { parentPageId: string; position: string };
  encryptedBlob: string;
  /** the manifest updatedAt of the root page, verified by the server */
  snapshotUpdatedAt: string;
  descendants?: {
    pageId: string;
    encryptedBlob: string;
    snapshotUpdatedAt: string;
  }[];
  /** the caller confirmed the warning about data the conversion destroys */
  acknowledgeDataDeletion: true;
}): Promise<IConvertToEncryptedResult> {
  const req = await api.post<IConvertToEncryptedResult>(
    "/pages/encryption/convert",
    data,
  );
  return req.data;
}

/** what a conversion destroyed, reported back so the UI can say so */
export interface IConvertToEncryptedResult {
  pageCount: number;
  deleted: {
    history: number;
    backlinks: number;
    transclusions: number;
    shares: number;
    comments: number;
    attachments: number;
  };
}

export async function updateEncryptedPage(data: {
  pageId: string;
  encryptedBlob: string;
  baseVersion: number;
  saveHistory?: boolean;
  title?: string;
}): Promise<{
  version: number;
  nextSnapshotInMs?: number;
  snapshotSaved?: boolean;
}> {
  const req = await api.post<{
    version: number;
    nextSnapshotInMs?: number;
    snapshotSaved?: boolean;
  }>("/pages/encryption/update", data);
  return req.data;
}

export async function rewrapPageKey(data: {
  pageId: string;
  encryptionMeta: EncryptionMeta;
  currentWrappedDek: string;
}): Promise<void> {
  await api.post<void>("/pages/encryption/rewrap", data);
}

export async function decryptPageToPlaintext(data: {
  pageId: string;
  content: any;
  /** the manifest encryptedVersion of the root page, verified by the server */
  baseVersion: number;
  descendants?: { pageId: string; content: any; baseVersion: number }[];
  /** the caller confirmed the warning about what removing encryption discards */
  acknowledgeDataDeletion: true;
}): Promise<void> {
  await api.post<void>("/pages/encryption/decrypt", data);
}
