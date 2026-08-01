import * as Y from "yjs";
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { getCollaborationUrl } from "@/lib/config.ts";
import {
  decryptRelayFrame,
  encryptBytes,
  sectionAad,
} from "@/features/encryption/services/crypto";
import {
  isRemoteOrigin,
  RELAY_ORIGIN,
} from "@/features/encryption/services/sync-origins";

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
// server close codes that must not trigger a plain reconnect
const CLOSE_UNAUTHORIZED = 4401;
// access was taken away — unlike 4401 there is no token to refresh, so
// retrying would just loop against a decision that will not change
const CLOSE_ACCESS_REVOKED = 4403;
const CLOSE_ENCRYPTION_CHANGED = 4410;
// the server also closes with 4412 when the room must be rebuilt but the page
// is still encrypted (moved to another space, node shutting down); that code
// is deliberately unlisted here so it falls through to the reconnect path,
// and the rejoin re-runs the server's full authorization check

export interface E2eeProvider {
  destroy(): void;
}

interface E2eeProviderOptions {
  pageId: string;
  /** encryption root whose key opens this page; binds relay frames to it */
  sectionId: string;
  ydoc: Y.Doc;
  dek: CryptoKey;
  awareness: Awareness;
  token: string;
  // called when the server rejects the collab token (close code 4401);
  // the owner can refresh the token and recreate the provider
  onUnauthorized?: () => void;
  // called when access to the page was taken away (close code 4403); there is
  // nothing to retry, so the owner should tell the user rather than reconnect
  onAccessRevoked?: () => void;
}

/**
 * Connects the decrypted Y.Doc of an encrypted page to the server's blind
 * relay. Every payload (Yjs updates, state vectors, awareness) is AES-GCM
 * encrypted with the page DEK before it leaves the browser; the server only
 * forwards ciphertext between authenticated members of the page room.
 */
export function createE2eeProvider(opts: E2eeProviderOptions): E2eeProvider {
  const {
    pageId,
    sectionId,
    ydoc,
    dek,
    awareness,
    token,
    onUnauthorized,
    onAccessRevoked,
  } = opts;

  // Relay frames carry their own context tags, distinct from the one on
  // stored blobs and distinct per frame type: a frame the server captured can
  // never be served back as a page's content, frames from another section
  // will not decrypt here, and the server cannot replay one kind of frame
  // (say, awareness) as another (a document update) — the type it announces
  // in plaintext must match the one authenticated into the ciphertext.
  const relayAad = {
    update: sectionAad(sectionId, "relay:update"),
    "sync-request": sectionAad(sectionId, "relay:sync-request"),
    "sync-response": sectionAad(sectionId, "relay:sync-response"),
    // the state vector riding along on a sync-response is its own frame
    "sync-response-sv": sectionAad(sectionId, "relay:sync-response-sv"),
    awareness: sectionAad(sectionId, "relay:awareness"),
  } as const;
  type RelayFrameType = keyof typeof relayAad;

  let ws: WebSocket | null = null;
  let ready = false;
  let destroyed = false;
  let reconnectDelay = RECONNECT_MIN_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const sendRaw = (message: Record<string, string>) => {
    if (ready && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const send = async (type: RelayFrameType, bytes: Uint8Array) => {
    if (!ready) return;
    sendRaw({ type, payload: await encryptBytes(dek, bytes, relayAad[type]) });
  };

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    // sibling tabs have their own relay connection; only forward local edits
    if (isRemoteOrigin(origin)) return;
    void send("update", update);
  };
  ydoc.on("update", onDocUpdate);

  const onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === RELAY_ORIGIN) return;
    const changed = changes.added.concat(changes.updated, changes.removed);
    void send("awareness", encodeAwarenessUpdate(awareness, changed));
  };
  awareness.on("update", onAwarenessUpdate);

  const handleMessage = async (raw: string) => {
    if (destroyed) return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "ready") {
      ready = true;
      reconnectDelay = RECONNECT_MIN_MS;
      // catch up with peers and announce our presence
      void send("sync-request", Y.encodeStateVector(ydoc));
      void send("awareness", encodeAwarenessUpdate(awareness, [ydoc.clientID]));
      return;
    }
    if (typeof msg.payload !== "string") return;
    if (
      msg.type !== "update" &&
      msg.type !== "sync-request" &&
      msg.type !== "sync-response" &&
      msg.type !== "awareness"
    ) {
      return;
    }

    let bytes: Uint8Array;
    try {
      // decrypting under the announced type's tag is what authenticates the
      // plaintext type field — a relabeled frame fails here
      bytes = await decryptRelayFrame(dek, msg.payload, relayAad[msg.type]);
    } catch {
      // wrong key (e.g. we hold a stale DEK) — ignore the message
      return;
    }
    // the provider may have been destroyed while decrypting; never touch
    // the doc or awareness after teardown (they may be destroyed too)
    if (destroyed) return;

    switch (msg.type) {
      case "update":
        Y.applyUpdate(ydoc, bytes, RELAY_ORIGIN);
        break;
      case "sync-request": {
        // snapshot both encodings before any await — the doc may be
        // destroyed while we encrypt
        const update = Y.encodeStateAsUpdate(ydoc, bytes);
        const stateVector = Y.encodeStateVector(ydoc);
        const payload = await encryptBytes(
          dek,
          update,
          relayAad["sync-response"],
        );
        if (destroyed) return;
        const encryptedStateVector = await encryptBytes(
          dek,
          stateVector,
          relayAad["sync-response-sv"],
        );
        if (destroyed) return;
        sendRaw({
          type: "sync-response",
          payload,
          stateVector: encryptedStateVector,
        });
        break;
      }
      case "sync-response": {
        Y.applyUpdate(ydoc, bytes, RELAY_ORIGIN);
        if (typeof msg.stateVector === "string") {
          try {
            const stateVector = await decryptRelayFrame(
              dek,
              msg.stateVector,
              relayAad["sync-response-sv"],
            );
            if (destroyed) return;
            void send("update", Y.encodeStateAsUpdate(ydoc, stateVector));
          } catch {
            // ignore undecryptable state vector
          }
        }
        break;
      }
      case "awareness":
        applyAwarenessUpdate(awareness, bytes, RELAY_ORIGIN);
        break;
    }
  };

  const open = () => {
    if (destroyed) return;
    const url = new URL(getCollaborationUrl());
    url.searchParams.set("e2ee", "1");
    url.searchParams.set("pageId", pageId);
    ws = new WebSocket(url.toString());

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: "auth", token }));
    };
    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        void handleMessage(event.data);
      }
    };
    ws.onclose = (event) => {
      ready = false;
      if (destroyed || event.code === CLOSE_ENCRYPTION_CHANGED) {
        return;
      }
      if (event.code === CLOSE_ACCESS_REVOKED) {
        onAccessRevoked?.();
        return;
      }
      if (event.code === CLOSE_UNAUTHORIZED) {
        // likely an expired collab token: let the owner refresh it and
        // recreate the provider instead of retrying a dead token
        onUnauthorized?.();
        return;
      }
      reconnectTimer = setTimeout(open, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
    };
    ws.onerror = () => {
      // onclose handles reconnection
    };
  };
  open();

  return {
    destroy() {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ydoc.off("update", onDocUpdate);
      // stop forwarding further awareness events, then announce leave and
      // encrypt+send on the still-open socket before closing (encrypt is
      // async, so a handler-based leave would race ready=false / close)
      awareness.off("update", onAwarenessUpdate);
      const socket = ws;
      ws = null;
      ready = false;
      try {
        removeAwarenessStates(awareness, [ydoc.clientID], "destroy");
        const leave = encodeAwarenessUpdate(awareness, [ydoc.clientID]);
        if (socket?.readyState === WebSocket.OPEN) {
          void encryptBytes(dek, leave, relayAad.awareness)
            .then((payload) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "awareness", payload }));
              }
            })
            .catch(() => {})
            .finally(() => socket.close());
          return;
        }
      } catch {
        // fall through to close
      }
      socket?.close();
    },
  };
}
