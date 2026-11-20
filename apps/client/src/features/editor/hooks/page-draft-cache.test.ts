import "fake-indexeddb/auto";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
} from "y-protocols/sync";
import {
  MessageType,
  type onMessageParameters,
  type onOutgoingMessageParameters,
} from "@hocuspocus/provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageDraftCache } from "./page-draft-cache";

let page: string;
const opened: PageDraftCache[] = [];
const errors = vi.fn();

function installLocks() {
  const locks = new Set<string>();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      async request(
        name: string,
        _options: unknown,
        callback: (lock: unknown) => Promise<void> | void,
      ) {
        if (locks.has(name)) return callback(null);
        locks.add(name);
        try {
          await callback({ name });
        } finally {
          locks.delete(name);
        }
      },
    },
  });
}

async function open(user = "writer") {
  const cache = new PageDraftCache(page, user, errors);
  opened.push(cache);
  return { cache, warm: await cache.restore() };
}

function message(type: number, update?: Uint8Array) {
  return {
    readVarUint: () => type,
    readVarUint8Array: () => update,
  } as onMessageParameters["message"];
}
function acknowledge(cache: PageDraftCache) {
  cache.incoming(message(1), MessageType.SyncStatus);
}
function sendBatch(cache: PageDraftCache) {
  const encoder = encoding.createEncoder();
  encoding.writeVarString(encoder, "page");
  encoding.writeVarUint(encoder, MessageType.Sync);
  encoding.writeVarUint(encoder, messageYjsUpdate);
  cache.outgoing({
    message: {
      type: MessageType.Sync,
      toUint8Array: () => encoding.toUint8Array(encoder),
    },
  } as onOutgoingMessageParameters);
}
function text(cache: PageDraftCache) {
  return cache.ydoc.getText("text").toString();
}
function add(cache: PageDraftCache, s: string) {
  const value = cache.ydoc.getText("text");
  value.insert(value.length, s);
}
async function seed() {
  const { cache } = await open();
  const server = new Y.Doc();
  server.getXmlFragment("default").insert(0, [new Y.XmlElement("paragraph")]);
  server.getText("text").insert(0, "baseline");
  cache.incoming(
    message(messageYjsSyncStep2, Y.encodeStateAsUpdate(server)),
    MessageType.Sync,
  );
  cache.close();
}

beforeEach(() => {
  page = crypto.randomUUID();
  errors.mockReset();
  installLocks();
});
afterEach(() => {
  opened.splice(0).forEach((c) => c.close());
  Reflect.deleteProperty(navigator, "locks");
});

describe("local collaborative drafts", () => {
  it("reports unavailable browser storage so the editor can use the server", async () => {
    const cache = new PageDraftCache(page, "writer", errors);
    opened.push(cache);
    vi.spyOn(IDBFactory.prototype, "open").mockImplementationOnce(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    await expect(cache.restore()).rejects.toThrow("Storage unavailable");
    expect(cache.opened).toBe(false);
  });

  it("keeps a sibling's unacknowledged writes before and after another tab's rollback", async () => {
    await seed();
    const { cache: sibling } = await open();
    add(sibling, " before");
    const { cache: denied } = await open();
    expect(text(denied)).toBe("baseline");
    add(denied, " refused");
    await denied.discard();
    denied.close();
    add(sibling, " after");
    sibling.close();
    const { cache, warm } = await open();
    expect(warm).toBe(true);
    expect(text(cache)).toBe("baseline before after");
    expect(errors).not.toHaveBeenCalled();
  });

  it("retains a sibling's insertion and deletion if its tab closes during rollback", async () => {
    await seed();
    const { cache: denied } = await open(),
      { cache: sibling } = await open();
    sibling.ydoc.getText("text").delete(0, 4);
    add(sibling, " safe");
    add(denied, " discarded");
    const rollback = denied.discard();
    sibling.close();
    await rollback;
    denied.close();
    const { cache } = await open();
    expect(text(cache)).toBe("line safe");
  });

  it("only promotes the acknowledged packet and keeps later edits out of the confirmed copy", async () => {
    await seed();
    const { cache } = await open();
    add(cache, " accepted");
    sendBatch(cache);
    add(cache, " refused");
    sendBatch(cache);
    acknowledge(cache);
    await cache.discard();
    cache.close();
    const { cache: reloaded } = await open();
    expect(text(reloaded)).toBe("baseline accepted");
  });

  it("recovers an abandoned draft exactly once through the next sync handshake", async () => {
    await seed();
    const { cache: original } = await open();
    add(original, " orphan");
    original.close();
    const { cache: restored } = await open();
    restored.incoming(message(messageYjsSyncStep1), MessageType.Sync);
    acknowledge(restored);
    restored.close();
    const { cache: one } = await open(),
      { cache: two } = await open();
    expect(text(one)).toBe("baseline orphan");
    expect(text(two)).toBe(text(one));
  });

  it("finishes an interrupted refusal before restoring another tab's draft", async () => {
    await seed();
    const { cache: a } = await open(),
      { cache: b } = await open();
    add(a, " refused");
    add(b, " safe");
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementationOnce(
      () => {
        throw new DOMException("temporarily unavailable", "InvalidStateError");
      },
    );
    await expect(a.discard()).rejects.toThrow("temporarily unavailable");
    vi.restoreAllMocks();
    a.close();
    b.close();
    const { cache: next } = await open();
    expect(text(next)).toBe("baseline safe");
  });

  it("keeps different accounts' drafts separate", async () => {
    const { cache } = await open();
    add(cache, "private draft");
    cache.close();
    const other = await open("other user");
    expect(text(other.cache)).toBe("");
    await other.cache.discard();
    expect(text((await open()).cache)).toBe("private draft");
  });

  it("defers recovery until write authorization on browsers without Web Locks", async () => {
    Reflect.deleteProperty(navigator, "locks");
    await seed();
    const { cache } = await open();
    add(cache, " offline");
    cache.close();
    const { cache: reader } = await open();
    expect(text(reader)).toBe("baseline");
    await reader.discard();
    reader.close();
    const { cache: writer } = await open();
    await writer.authenticated(true);
    expect(text(writer)).toBe("baseline offline");
  });

  it("imports edits written by the previous version without deleting its database", async () => {
    const legacyDoc = new Y.Doc();
    const legacy = new IndexeddbPersistence("page." + page, legacyDoc);
    await legacy.whenSynced;
    legacyDoc.getText("text").insert(0, "previous draft");
    await legacy.destroy();
    const { cache } = await open();
    expect(text(cache)).toBe("previous draft");
    await cache.discard();
    cache.close();
    const { cache: other } = await open();
    expect(text(other)).toBe("");
    const old = new Y.Doc(),
      reader = new IndexeddbPersistence("page." + page, old);
    await reader.whenSynced;
    expect(old.getText("text").toString()).toBe("previous draft");
    old.getText("text").insert(old.getText("text").length, " late write");
    await reader.destroy();
    other.close();
    const { cache: newer } = await open();
    await newer.authenticated(true);
    expect(text(newer)).toBe("previous draft late write");
  });

  it("preserves a closed sibling's unsubmitted draft when a different tab is denied", async () => {
    await seed();
    const { cache: sibling } = await open();
    add(sibling, " independent");
    sibling.close();
    const { cache: denied } = await open();
    expect(text(denied)).toBe("baseline independent");
    add(denied, " refused");
    await denied.discard();
    denied.close();
    const { cache: recovered } = await open();
    await recovered.authenticated(false);
    expect(text(recovered)).toBe("baseline");
    await recovered.authenticated(true);
    expect(text(recovered)).toBe("baseline independent");
  });

  it("recognizes server-confirmed empty pages and waits for the server on explicit recovery", async () => {
    const { cache, warm } = await open();
    expect(warm).toBe(false);
    cache.markSynced();
    cache.close();
    expect((await open()).warm).toBe(true);
    const fresh = new PageDraftCache(page, "writer", errors);
    opened.push(fresh);
    expect(await fresh.restore(true)).toBe(false);
  });

  it("retains the draft when writing its acknowledgement fails partway", async () => {
    await seed();
    const { cache } = await open();
    add(cache, " durable");
    sendBatch(cache);
    const original = IDBObjectStore.prototype.delete;
    const fail = vi
      .spyOn(IDBObjectStore.prototype, "delete")
      .mockImplementationOnce(function (key) {
        if (this.name === "custom")
          throw new DOMException("disk full", "QuotaExceededError");
        return original.call(this, key);
      });
    acknowledge(cache);
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());
    fail.mockRestore();
    cache.close();
    expect(text((await open()).cache)).toBe("baseline durable");
  });

  it("compacts confirmed changes without folding in another tab's private draft", async () => {
    await seed();
    const { cache: first } = await open(),
      { cache: sibling } = await open();
    add(sibling, " private");
    const peer = new Y.Doc();
    peer.on("update", (update: Uint8Array) =>
      first.incoming(message(messageYjsUpdate, update), MessageType.Sync),
    );
    const log = peer.getText("server");
    for (let i = 0; i < 510; i++) log.insert(log.length, "x");
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("page." + page + ".user.writer");
      req.onsuccess = () => resolve(req.result);
    });
    try {
      await vi.waitFor(
        async () => {
          const count = await new Promise<number>((resolve) => {
            const req = db
              .transaction("updates")
              .objectStore("updates")
              .count();
            req.onsuccess = () => resolve(req.result);
          });
          expect(count).toBeLessThan(25);
        },
        { timeout: 4000 },
      );
    } finally {
      db.close();
    }
    first.close();
    const { cache: reader } = await open();
    expect(reader.ydoc.getText("server").length).toBe(510);
    expect(text(reader)).toBe("baseline");
    reader.close();
    sibling.close();
    expect(text((await open()).cache)).toBe("baseline private");
  });
});
