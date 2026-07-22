import * as Y from "yjs";
import {
  isRemoteOrigin,
  TAB_SYNC_ORIGIN,
} from "@/features/encryption/services/sync-origins";

type TabSyncMessage =
  | { type: "update"; update: Uint8Array }
  | { type: "sync-request"; stateVector: Uint8Array }
  | { type: "sync-response"; update: Uint8Array; stateVector: Uint8Array };

/**
 * Keeps the decrypted Y.Doc of an encrypted page in sync across tabs of the
 * same browser via BroadcastChannel. Updates never leave the machine and are
 * only exchanged between tabs that have independently obtained the DEK.
 * Returns a cleanup function.
 */
export function createTabSync(pageId: string, ydoc: Y.Doc): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  const channel = new BroadcastChannel(`docmost-e2ee-doc:${pageId}`);

  const post = (message: TabSyncMessage) => {
    try {
      channel.postMessage(message);
    } catch {
      // channel already closed
    }
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    // forward local edits only: sibling tabs have their own relay
    // connection, so relay/merge updates would be double-delivered
    if (!isRemoteOrigin(origin)) {
      post({ type: "update", update });
    }
  };
  ydoc.on("update", onUpdate);

  channel.onmessage = (event: MessageEvent<TabSyncMessage>) => {
    const msg = event.data;
    if (msg.type === "update") {
      Y.applyUpdate(ydoc, msg.update, TAB_SYNC_ORIGIN);
    } else if (msg.type === "sync-request") {
      post({
        type: "sync-response",
        update: Y.encodeStateAsUpdate(ydoc, msg.stateVector),
        stateVector: Y.encodeStateVector(ydoc),
      });
    } else if (msg.type === "sync-response") {
      Y.applyUpdate(ydoc, msg.update, TAB_SYNC_ORIGIN);
      // send back whatever the responder is missing from us
      post({
        type: "update",
        update: Y.encodeStateAsUpdate(ydoc, msg.stateVector),
      });
    }
  };

  // catch up with any sibling tab that is already open on this page
  post({ type: "sync-request", stateVector: Y.encodeStateVector(ydoc) });

  return () => {
    ydoc.off("update", onUpdate);
    channel.close();
  };
}
