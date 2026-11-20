import "fake-indexeddb/auto";
import { IndexeddbPersistence } from "y-indexeddb";
import { fromBase64 } from "lib0/buffer";
import { rtop } from "lib0/indexeddb";
import * as Y from "yjs";
import { messageYjsSyncStep2, messageYjsUpdate } from "y-protocols/sync";
import { MessageType, type onMessageParameters } from "@hocuspocus/provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageDraftCache } from "./page-draft-cache";
import { failedPageWrites } from "@/lib/local-page-data";

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
  cache.sent(messageYjsUpdate, true);
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
  vi.unstubAllGlobals();
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
    restored.sent(messageYjsSyncStep2, true);
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

  it("keeps ownerless previous-version edits intact and out of both accounts", async () => {
    const oldDoc = new Y.Doc();
    const writer = new IndexeddbPersistence("page." + page, oldDoc);
    await writer.whenSynced;
    oldDoc.getText("text").insert(0, "unpublished work");
    await writer.destroy();
    for (const user of ["first", "second"]) {
      const { cache } = await open(user);
      await cache.authenticated(true);
      expect(text(cache)).toBe("");
    }
    const reader = new IndexeddbPersistence("page." + page, new Y.Doc());
    await reader.whenSynced;
    expect(reader.doc.getText("text").toString()).toBe("unpublished work");
    await reader.destroy();
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

  it.each([true, false])(
    "recovers a failed append and its dependent edit (next write %s)",
    async (retry) => {
      const { cache } = await open();
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementationOnce(() => {
        throw new DOMException("Disk full", "QuotaExceededError");
      });
      add(cache, "A");
      await vi.waitFor(() => expect(errors).toHaveBeenCalled());
      vi.restoreAllMocks();
      if (retry) add(cache, "B");
      cache.close();
      expect(text((await open("other account")).cache)).toBe("");
      const recovered = (await open()).cache;
      expect(text(recovered)).toBe(retry ? "AB" : "A");
      recovered.sent(messageYjsSyncStep2, true);
      acknowledge(recovered);
      recovered.close();
      expect(text((await open()).cache)).toBe(retry ? "AB" : "A");
    },
  );

  it("defers unpublished edits while verification is pending or locked, including on reconnect", async () => {
    await seed();
    const { cache: previous } = await open();
    add(previous, " unpublished");
    previous.close();
    let allowed = false;
    const cache = new PageDraftCache(page, "writer", errors, () => allowed);
    opened.push(cache);
    await cache.restore();
    await cache.authenticated(true);
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(cache.ydoc));
    expect(peer.getText("text").toString()).toBe("baseline");
    cache.disconnected();
    await cache.authenticated(true);
    expect(text(cache)).toBe("baseline");
    allowed = true;
    await cache.resumeDrafts();
    expect(text(cache)).toBe("baseline unpublished");
  });

  it("rescans a now-closed writer's draft on writable reconnect", async () => {
    await seed();
    const { cache: writer } = await open();
    add(writer, " offline");
    const { cache: sibling } = await open();
    await sibling.authenticated(true);
    expect(text(sibling)).toBe("baseline");
    sibling.disconnected();
    writer.close();
    await sibling.authenticated(true);
    expect(text(sibling)).toBe("baseline offline");
  });

  it("preserves a refused edit locally without replaying it on reconnect", async () => {
    await seed();
    const { cache } = await open();
    const key = ["refused-copy", cache.ydoc.guid];
    async function storedCopy(user: string) {
      const db: IDBDatabase = await rtop(
        indexedDB.open(`page.${page}.user.${user}`),
      );
      try {
        return await rtop(
          db.transaction("custom").objectStore("custom").get(key),
        );
      } finally {
        db.close();
      }
    }
    add(cache, " draft");
    await cache.discard();
    cache.close();
    const { cache: reopened } = await open();
    await reopened.authenticated(true);
    expect(text(reopened)).toBe("baseline");
    const copy = new Y.Doc();
    Y.applyUpdate(copy, (await storedCopy("writer")).update);
    expect(copy.getText("text").toString()).toBe("baseline draft");
    copy.destroy();
    await open("different");
    expect(await storedCopy("different")).toBeUndefined();
    await reopened.discard(true);
    expect(await storedCopy("writer")).toBeUndefined();
  });

  it("keeps an abandoned draft available to its writer after a read-only visit", async () => {
    await seed();
    const { cache: old } = await open();
    add(old, " before downgrade");
    old.close();
    const reader = new PageDraftCache(page, "writer", errors, () => false);
    opened.push(reader);
    await reader.restore();
    await reader.authenticated(false);
    expect(text(reader)).toBe("baseline");
    expect(text((await open()).cache)).toBe("baseline before downgrade");
  });

  it("preserves a refused edit locally when IndexedDB cannot open", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("IDBKeyRange", undefined);
    const tab = new PageDraftCache(page, "writer", errors);
    tab.useBackupStorage();
    add(tab, " last edit");
    tab.close();
    const next = new PageDraftCache(page, "writer", errors);
    next.useBackupStorage();
    await next.authenticated(true);
    expect(text(next)).toBe(" last edit");
    await next.discard();
    next.close();
    const reader = new PageDraftCache(page, "writer", errors);
    reader.useBackupStorage();
    opened.push(reader);
    await reader.authenticated(false);
    const backups = failedPageWrites.read(`page.${page}.user.writer.recovery`);
    expect(backups.size).toBe(1);
    const [encoded] = backups.values();
    const recovered = new Y.Doc();
    Y.applyUpdate(recovered, fromBase64(encoded));
    expect(recovered.getText("text").toString()).toBe(" last edit");
    recovered.destroy();
    expect(text(reader)).toBe("");
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
    for (let i = 0; i < 255; i++) {
      log.insert(0, "x".repeat(1024));
      log.delete(0, 1024);
    }
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
          const records = await new Promise<Uint8Array[]>((resolve) => {
            const req = db
              .transaction("updates")
              .objectStore("updates")
              .getAll();
            req.onsuccess = () => resolve(req.result);
          });
          expect(
            records.reduce((bytes, item) => bytes + item.byteLength, 0),
          ).toBeLessThan(25_000);
        },
        { timeout: 4000 },
      );
    } finally {
      db.close();
    }
    first.close();
    const { cache: reader } = await open();
    expect(reader.ydoc.getText("server").length).toBe(0);
    expect(text(reader)).toBe("baseline");
    reader.close();
    sibling.close();
    expect(text((await open()).cache)).toBe("baseline private");
  });
});
