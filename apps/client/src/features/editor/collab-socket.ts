import {
  HocuspocusProviderWebsocket,
  WebSocketStatus,
} from "@hocuspocus/provider";
import { getCollaborationUrl } from "@/lib/config.ts";

const RELEASE_GRACE_MS = 5000;

let socket: HocuspocusProviderWebsocket | null = null;
let editorCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function getCollabSocket(): HocuspocusProviderWebsocket {
  if (!socket) {
    const url = getCollaborationUrl();
    socket = new HocuspocusProviderWebsocket({
      url,
      autoConnect: false,
      // Close codes are how you tell a proxy problem from an app problem:
      // 1006 = the TCP connection was killed (read timeout / LB idle limit),
      // 4408 = 30s with no inbound frame on an open socket (proxy buffering),
      // 1011 = the server refused a frame and forced a resync.
      // See docs/reverse-proxy.md
      onClose: ({ event }) => {
        console.warn("[collab] socket closed", {
          code: event?.code,
          reason: event?.reason,
          url,
        });
      },
      onStatus: ({ status }) => console.info("[collab] status", status),
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
