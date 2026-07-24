import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { decryptBytes } from "@/features/encryption/services/crypto";

// v2 encrypted blobs contain a full-state Yjs update prefixed with this magic
// marker. v1 blobs are bare utf8 ProseMirror JSON, which always starts with
// "{" and can never collide with the marker.
const YDOC_MAGIC = new TextEncoder().encode("DMYD2:");

export type DecodedBlob =
  | { kind: "ydoc"; update: Uint8Array }
  | { kind: "json"; content: any };

export function encodeYdocBlob(doc: Y.Doc): Uint8Array {
  const update = Y.encodeStateAsUpdate(doc);
  const out = new Uint8Array(YDOC_MAGIC.length + update.length);
  out.set(YDOC_MAGIC, 0);
  out.set(update, YDOC_MAGIC.length);
  return out;
}

export function decodeBlob(bytes: Uint8Array): DecodedBlob {
  const hasMagic =
    bytes.length >= YDOC_MAGIC.length &&
    YDOC_MAGIC.every((byte, i) => bytes[i] === byte);
  if (hasMagic) {
    return { kind: "ydoc", update: bytes.slice(YDOC_MAGIC.length) };
  }
  return { kind: "json", content: JSON.parse(new TextDecoder().decode(bytes)) };
}

/**
 * Decrypt an encrypted page/history blob (base64) into prosemirror JSON.
 * v1 blobs are already prosemirror JSON; v2 blobs are Yjs full-state updates
 * and go through a throwaway Y.Doc.
 */
export async function decryptBlobToProsemirrorJSON(
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
