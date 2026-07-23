import api from "@/lib/api-client";
import { EncryptionMeta } from "@/features/encryption/types/encryption.types";

export interface IEncryptedBlobResponse {
  pageId: string;
  encryptionMeta: EncryptionMeta;
  encryptedBlob: string | null;
  version: number;
}

export async function getEncryptedBlob(
  pageId: string,
): Promise<IEncryptedBlobResponse> {
  const req = await api.post<IEncryptedBlobResponse>("/pages/encryption/blob", {
    pageId,
  });
  return req.data;
}

export async function convertPageToEncrypted(data: {
  pageId: string;
  encryptionMeta: EncryptionMeta;
  encryptedBlob: string;
}): Promise<void> {
  await api.post<void>("/pages/encryption/convert", data);
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
}): Promise<void> {
  await api.post<void>("/pages/encryption/decrypt", data);
}
