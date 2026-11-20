import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
  MessageType,
  type onMessageParameters,
} from "@hocuspocus/provider";
import {
  createDecoder,
  readVarString,
  readVarUint,
  readVarUint8Array,
} from "lib0/decoding";
import {
  createEncoder,
  toUint8Array,
  writeVarString,
  writeVarUint,
  writeVarUint8Array,
} from "lib0/encoding";
import { messageYjsSyncStep2, messageYjsUpdate } from "y-protocols/sync";
import * as Y from "yjs";
import { expect, it, vi } from "vitest";
import { PageCollabSocket } from "./collab-socket";
import { PageDraftCache } from "./hooks/page-draft-cache";

vi.mock("@/lib/config.ts", () => ({
  getCollaborationUrl: () => "ws://localhost",
}));

it("withholds offline edits from the handshake until the page can accept them", () => {
  const name = "page.scratch";
  const cache = new PageDraftCache("scratch", "writer", vi.fn());
  cache.useBackupStorage();
  const local = cache.ydoc;
  local.getText("body").insert(0, "unpublished");
  const server = new Y.Doc();
  const send = vi
    .spyOn(HocuspocusProviderWebsocket.prototype, "send")
    .mockImplementation((bytes) => {
      const decoder = createDecoder(bytes);
      expect(readVarString(decoder)).toBe(name);
      expect(readVarUint(decoder)).toBe(MessageType.Sync);
      readVarUint(decoder);
      Y.applyUpdate(server, readVarUint8Array(decoder));
      cache.incoming(
        {} as onMessageParameters["message"],
        MessageType.SyncStatus,
      );
    });
  const socket = new PageCollabSocket({
    autoConnect: false,
    url: "ws://localhost",
  });
  const provider = new HocuspocusProvider({
    name,
    websocketProvider: socket,
    document: local,
  });
  const sync = vi.spyOn(provider, "forceSync").mockImplementation(() => {});
  provider.isAuthenticated = true;
  let allowed = false;
  const unbind = socket.bindRoom(provider, () => allowed, cache);
  const packet = (type: number, update = Y.encodeStateAsUpdate(local)) => {
    const message = createEncoder();
    writeVarString(message, name);
    writeVarUint(message, MessageType.Sync);
    writeVarUint(message, type);
    writeVarUint8Array(message, update);
    socket.send(toUint8Array(message));
  };
  try {
    packet(messageYjsUpdate);
    expect(send).not.toHaveBeenCalled();
    Object.defineProperty(socket, "webSocket", {
      configurable: true,
      value: { readyState: WebSocket.OPEN },
    });
    packet(messageYjsSyncStep2);
    packet(messageYjsUpdate);
    expect(send).toHaveBeenCalledTimes(1);
    expect(server.getText("body").toString()).toBe("");
    allowed = true;
    socket.resume(provider);
    expect(sync).toHaveBeenCalledOnce();
    const before = Y.encodeStateVector(local);
    local.getText("body").insert(11, " edit");
    packet(messageYjsUpdate, Y.encodeStateAsUpdate(local, before));
    expect(send).toHaveBeenCalledTimes(1);
    expect(cache.hasPending).toBe(true);
    packet(messageYjsSyncStep2);
    expect(server.getText("body").toString()).toBe("unpublished edit");
    expect(cache.hasPending).toBe(false);
  } finally {
    unbind();
    Object.defineProperty(socket, "webSocket", {
      configurable: true,
      writable: true,
      value: null,
    });
    provider.destroy();
    cache.close();
    socket.destroy();
    send.mockRestore();
    local.destroy();
    server.destroy();
  }
});
