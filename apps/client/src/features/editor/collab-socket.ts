import {
  HocuspocusProviderWebsocket,
  type HocuspocusProvider,
  MessageType,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { getCollaborationUrl } from "@/lib/config.ts";
import { createDecoder, readVarString, readVarUint } from "lib0/decoding";
import {
  createEncoder,
  toUint8Array,
  writeVarString,
  writeVarUint,
  writeVarUint8Array,
} from "lib0/encoding";
import { messageYjsSyncStep2, messageYjsUpdate } from "y-protocols/sync";
import type { PageDraftCache } from "./hooks/page-draft-cache";

const RELEASE_GRACE_MS = 5000;

type Room = {
  canPublish: () => boolean;
  cache?: PageDraftCache;
  withheld: boolean;
  resyncing: boolean;
  provider: HocuspocusProvider;
};

export class PageCollabSocket extends HocuspocusProviderWebsocket {
  private rooms = new Map<string, Room>();

  bindRoom(
    provider: HocuspocusProvider,
    canPublish: () => boolean,
    cache?: PageDraftCache,
  ) {
    const room = {
      canPublish,
      cache,
      withheld: false,
      resyncing: false,
      provider,
    };
    this.rooms.set(provider.effectiveName, room);
    return () => {
      if (this.rooms.get(provider.effectiveName) !== room) return;
      provider.flushPendingUpdates();
      this.rooms.delete(provider.effectiveName);
    };
  }

  resume(provider: HocuspocusProvider) {
    const room = this.rooms.get(provider.effectiveName);
    if (
      room?.withheld &&
      !room.resyncing &&
      room.canPublish() &&
      provider.isAuthenticated
    ) {
      room.resyncing = true;
      provider.forceSync();
    }
  }

  override send(message: Uint8Array) {
    // Connection-level ping/pong packets have no room name.
    if (message.length <= 1) return super.send(message);
    const decoder = createDecoder(message);
    const name = readVarString(decoder);
    if (readVarUint(decoder) !== MessageType.Sync) return super.send(message);
    const subtype = readVarUint(decoder);
    if (subtype !== messageYjsSyncStep2 && subtype !== messageYjsUpdate)
      return super.send(message);
    // The next state-vector handshake covers offline edits. Queuing these
    // bytes could send them before verification is rechecked on reconnect.
    const room = this.rooms.get(name);
    if (!room) return;
    if (this.webSocket?.readyState !== WebSocket.OPEN) {
      room.withheld = true;
      room.resyncing = false;
      if (subtype === messageYjsUpdate) room.cache?.withholdBatch();
      return;
    }
    if (room.canPublish()) {
      if (room.withheld && subtype === messageYjsUpdate) {
        // This batch can depend on an earlier withheld edit. Send the whole
        // missing history first, even if typing resumes before the sync reply.
        room.cache?.withholdBatch();
        this.resume(room.provider);
        return;
      }
      room.withheld = false;
      room.resyncing = false;
      room.cache?.sent(subtype, true);
      return super.send(message);
    }
    room.withheld = true;
    room.resyncing = false;
    if (subtype === messageYjsUpdate) {
      room.cache?.withholdBatch();
      return;
    }
    // A reader still completes the handshake and receives live server edits.
    const response = createEncoder();
    writeVarString(response, name);
    writeVarUint(response, MessageType.Sync);
    writeVarUint(response, messageYjsSyncStep2);
    writeVarUint8Array(response, new Uint8Array([0, 0]));
    room.cache?.sent(subtype, false);
    super.send(toUint8Array(response));
  }
}

let socket: PageCollabSocket | null = null;
let editorCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function getCollabSocket(): PageCollabSocket {
  if (!socket) {
    socket = new PageCollabSocket({
      url: getCollaborationUrl(),
      autoConnect: false,
    });
  }
  return socket;
}

export function acquireCollabSocket(): void {
  editorCount++;
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  const collabSocket = getCollabSocket();
  collabSocket.shouldConnect = true;
  if (collabSocket.status === WebSocketStatus.Disconnected) {
    collabSocket.connect();
  }
}

export function releaseCollabSocket(): void {
  editorCount--;
  if (editorCount > 0) return;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (editorCount === 0) {
      socket?.disconnect();
    }
  }, RELEASE_GRACE_MS);
}
