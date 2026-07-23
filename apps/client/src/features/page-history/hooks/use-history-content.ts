import { useEffect, useState } from "react";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { IPageHistory } from "@/features/page-history/types/page.types";
import { usePageKey } from "@/features/encryption/hooks/page-key-store";
import { decryptBytes } from "@/features/encryption/services/crypto";
import { decodeBlob } from "@/features/encryption/services/encrypted-blob";

export type HistoryContent =
  | { status: "ready"; content: any }
  | { status: "decrypting" }
  /** the snapshot is encrypted and the page DEK is not in the vault */
  | { status: "locked" }
  | { status: "error" };

/** Decrypt an encrypted snapshot into prosemirror JSON. */
export async function decryptHistoryContent(
  dek: CryptoKey,
  encryptedBlob: string,
): Promise<any> {
  const decoded = decodeBlob(await decryptBytes(dek, encryptedBlob));
  if (decoded.kind !== "ydoc") {
    return decoded.content;
  }
  const doc = new Y.Doc();
  Y.applyUpdate(doc, decoded.update);
  const json = yDocToProsemirrorJSON(doc, "default");
  doc.destroy();
  return json;
}

/**
 * Resolves a history snapshot to prosemirror JSON. Plaintext snapshots pass
 * straight through; encrypted ones are decrypted here with the page DEK, so
 * plaintext only ever exists in this hook's state — never in the query cache
 * or storage — and is discarded as soon as the page locks or the view closes.
 */
export function useHistoryContent(
  history: IPageHistory | undefined,
): HistoryContent {
  const dek = usePageKey(history?.pageId ?? "");
  // keyed by history id so a version switch never shows the previous content
  const [resolved, setResolved] = useState<{
    historyId: string;
    content?: any;
    error?: boolean;
  } | null>(null);

  const historyId = history?.id;
  const encryptedBlob = history?.isEncrypted ? history.encryptedBlob : null;

  useEffect(() => {
    // No key (page locked), no blob, or no version selected: nothing to
    // decrypt. Any previously decrypted content was already dropped by this
    // effect's cleanup, which runs before the re-run that lands here.
    if (!historyId || !encryptedBlob || !dek) {
      return;
    }
    let cancelled = false;
    decryptHistoryContent(dek, encryptedBlob)
      .then((content) => {
        if (!cancelled) setResolved({ historyId, content });
      })
      .catch(() => {
        if (!cancelled) setResolved({ historyId, error: true });
      });
    // Discards the plaintext on unmount (modal close) and on every version or
    // key change — locking the page changes `dek`, so this is what makes the
    // decrypted content actually go away rather than just being hidden by the
    // "locked" status below.
    return () => {
      cancelled = true;
      setResolved(null);
    };
  }, [historyId, encryptedBlob, dek]);

  if (!history?.isEncrypted) {
    return { status: "ready", content: history?.content ?? null };
  }
  if (!encryptedBlob) {
    return { status: "error" };
  }
  if (!dek) {
    return { status: "locked" };
  }
  if (resolved?.historyId !== history.id) {
    return { status: "decrypting" };
  }
  return resolved.error
    ? { status: "error" }
    : { status: "ready", content: resolved.content };
}
