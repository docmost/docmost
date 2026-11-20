import {
  HocuspocusProvider,
  MessageType,
  type onMessageParameters,
  type onOutgoingMessageParameters,
} from "@hocuspocus/provider";
import { createDecoder, readVarString, readVarUint } from "lib0/decoding";
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
} from "y-protocols/sync";
import * as Y from "yjs";

// Keep the y-indexeddb store layout. Only server-confirmed updates go in
// "updates". Individual drafts stay in "custom" until their packet is acknowledged.
const COMPACT_AFTER = 500;
const DRAFT = "draft";
const WAIT_FOR_WRITE = "draft-requires-write";
const EMPTY = "empty-page-synced";
const LEGACY_CURSOR = "legacy-update-cursor";
const RESTORE = Symbol("restore page");
type DraftKey = [string, string, number];
type Draft = { key: DraftKey; update: Uint8Array };

// If a tab closes during a refused write's rollback (or IndexedDB aborts),
// the next opener must finish that rollback before it can replay the draft.
function refusalMarker(
  database: string,
  owner: string,
  action: "get" | "set" | "remove",
) {
  const key = `${database}.refused.${owner}`;
  try {
    if (action === "set") localStorage.setItem(key, "1");
    if (action === "remove") localStorage.removeItem(key);
    if (action === "get") return localStorage.getItem(key) === "1";
  } catch {
    /* The IndexedDB rollback still runs if localStorage is unavailable. */
  }
  return false;
}

function result<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function write(
  db: IDBDatabase,
  stores: string | string[],
  change: (tx: IDBTransaction) => void | Promise<void>,
) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Page cache transaction aborted"));
    const abort = (error: unknown) => {
      reject(error);
      try {
        tx.abort();
      } catch {
        // A failed IndexedDB request may already have aborted this transaction.
      }
    };
    try {
      const pending = change(tx);
      if (pending) void pending.then(() => tx.commit?.()).catch(abort);
      else tx.commit?.();
    } catch (error) {
      abort(error);
    }
  });
}

function openDatabase(name: string) {
  const request = indexedDB.open(name);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("updates", { autoIncrement: true });
    request.result.createObjectStore("custom");
  };
  return result(request);
}

// Combine only records that actually committed. Reading and replacing them in
// one transaction keeps a concurrent tab's append or rollback in order.
function compact(db: IDBDatabase) {
  return write(db, "updates", async (tx) => {
    const store = tx.objectStore("updates");
    const updates = await result<Uint8Array[]>(store.getAll());
    if (updates.length >= COMPACT_AFTER) {
      const merged = Y.mergeUpdates(updates);
      store.clear();
      store.add(merged);
    }
  });
}

// Read the old per-page cache without taking ownership of it. An older tab can
// continue using its connection while this version imports an existing draft.
async function readLegacy(name: string, cursor: number) {
  if (
    !cursor &&
    indexedDB.databases &&
    !(await indexedDB.databases()).some((db) => db.name === name)
  )
    return;
  const db = await openDatabase(name);
  try {
    const tx = db.transaction(["updates", "custom"]);
    const range = IDBKeyRange.lowerBound(cursor, true);
    const store = tx.objectStore("updates");
    const [keys, updates, empty] = await Promise.all([
      result(store.getAllKeys(range)),
      result<Uint8Array[]>(store.getAll(range)),
      result(tx.objectStore("custom").get(EMPTY)),
    ]);
    return { keys, updates, empty };
  } finally {
    db.close();
  }
}

export class PageDraftCache {
  readonly ydoc = new Y.Doc();
  private readonly name: string;
  private db: IDBDatabase | null = null;
  private readonly pending = new Map<string, Draft>();
  private readonly owned = new Set<string>();
  private deferred = false;
  private connection = 0;
  private unsent: Draft[] = [];
  private packets: Draft[][] = [];
  private sequence = 0;
  private closed = false;
  private refused = false;
  private writes = 0;
  private compacting = false;
  private releaseLocks!: () => void;
  private readonly lifetime = new Promise<void>((resolve) => {
    this.releaseLocks = resolve;
  });
  private lockManager: LockManager | undefined = navigator.locks;

  constructor(
    private pageId: string,
    userId: string,
    private onWriteError: () => void,
  ) {
    this.name = `page.${pageId}.user.${userId}`;
  }

  get opened() {
    return this.db !== null;
  }

  // A suspended tab still owns its draft. Browser locks are released by the
  // browser itself on close or crash. No heartbeat or wall-clock timeout is used.
  private async claim(owner: string) {
    if (this.owned.has(owner)) return true;
    if (!this.lockManager) return false;
    return new Promise<boolean>((resolve) => {
      this.lockManager!.request(
        `${this.name}:${owner}`,
        { ifAvailable: true },
        (lock) => {
          if (lock && !this.closed) this.owned.add(owner);
          resolve(Boolean(lock) && !this.closed);
          if (lock) return this.lifetime;
        },
      ).catch(() => {
        this.lockManager = undefined;
        resolve(false);
      });
    });
  }

  private async migrate() {
    const cursor =
      Number(
        await result(
          this.db!.transaction("custom")
            .objectStore("custom")
            .get(LEGACY_CURSOR),
        ),
      ) || 0;
    const legacy = await readLegacy(`page.${this.pageId}`, cursor);
    if (this.closed || !legacy?.keys.length) return;
    await write(this.db!, "custom", async (tx) => {
      const store = tx.objectStore("custom");
      // Another importer may have advanced the cursor since our first read.
      const current = Number(await result(store.get(LEGACY_CURSOR))) || 0;
      const unseen = legacy.updates.filter(
        (_, i) => Number(legacy.keys[i]) > current,
      );
      if (unseen.length) {
        const last = Number(legacy.keys[legacy.keys.length - 1]);
        const update = Y.mergeUpdates(unseen);
        if (update.length > 2) store.put(update, [DRAFT, "legacy", last]);
        if (legacy.empty === 1) store.put(1, EMPTY);
        store.put(last, LEGACY_CURSOR);
      }
    });
  }

  async restore(serverOnly = false) {
    const db = await openDatabase(this.name);
    if (this.closed) {
      db.close();
      return false;
    }
    this.db = db;
    db.onversionchange = () => {
      db.close();
    };
    await Promise.all([this.claim(this.ydoc.guid), this.migrate()]);
    if (this.closed) return false;
    const syncedEmpty = !serverOnly && (await this.restoreDrafts(false, true));
    if (this.closed) return false;
    this.ydoc.on("update", this.onUpdate);
    return (
      !serverOnly &&
      (this.ydoc.getXmlFragment("default").length > 0 || !!syncedEmpty)
    );
  }

  private async restoreDrafts(
    writeAuthorized: boolean,
    includeConfirmed = false,
  ) {
    if (this.closed || this.refused) return;
    const connection = this.connection;
    // Browsers without Web Locks adopt another writer's draft only after the
    // collaboration server has granted this connection write access.
    const range = IDBKeyRange.bound([DRAFT], [DRAFT, []]);
    const keys =
      this.lockManager || writeAuthorized
        ? await result(
            this.db!.transaction("custom")
              .objectStore("custom")
              .getAllKeys(range),
          )
        : [];
    const owners = new Set(keys.map((key) => (key as DraftKey)[1]));
    const claimed = new Set<string>();
    await Promise.all(
      Array.from(owners, async (owner) => {
        if (
          owner === this.ydoc.guid ||
          (this.lockManager && !(await this.claim(owner))) ||
          this.closed
        )
          return;
        if (refusalMarker(this.name, owner, "get")) {
          await write(this.db!, "custom", (tx) => {
            tx.objectStore("custom").delete(
              IDBKeyRange.bound([DRAFT, owner], [DRAFT, owner, []]),
            );
          });
          refusalMarker(this.name, owner, "remove");
        } else {
          claimed.add(owner);
        }
      }),
    );
    if (
      this.closed ||
      this.refused ||
      (writeAuthorized && connection !== this.connection)
    )
      return;
    // Re-read after claiming. The previous owner may have saved or discarded a
    // draft between the first read and our lock acquisition.
    const snapshot = this.db!.transaction(
      includeConfirmed ? ["custom", "updates"] : ["custom"],
    );
    const fresh = snapshot.objectStore("custom");
    const [confirmed, empty, drafts] = await Promise.all([
      includeConfirmed
        ? result<Uint8Array[]>(snapshot.objectStore("updates").getAll())
        : [],
      includeConfirmed ? result(fresh.get(EMPTY)) : undefined,
      Promise.all(
        keys.map(async (value) => {
          const key = value as DraftKey;
          if (!claimed.has(key[1])) return;
          const [update, needsGrant] = await Promise.all([
            result<Uint8Array | undefined>(fresh.get(key)),
            result(fresh.get([WAIT_FOR_WRITE, key[1], key[2]])),
          ]);
          if (update && needsGrant && !writeAuthorized) {
            this.deferred = true;
            return;
          }
          if (update) return { key, update };
        }),
      ),
    ]);
    if (
      this.closed ||
      this.refused ||
      (writeAuthorized && connection !== this.connection)
    )
      return;
    const restored = drafts.filter(
      (draft): draft is Draft =>
        !!draft && !this.pending.has(JSON.stringify(draft.key)),
    );
    if (includeConfirmed) this.writes = confirmed.length;
    for (const draft of restored)
      this.pending.set(JSON.stringify(draft.key), draft);
    if (writeAuthorized) this.unsent.push(...restored);
    const updates = [...confirmed, ...restored.map((d) => d.update)];
    if (updates.length)
      Y.applyUpdate(
        this.ydoc,
        updates.length === 1 ? updates[0] : Y.mergeUpdates(updates),
        RESTORE,
      );
    return empty === 1;
  }

  async authenticated(writable: boolean) {
    this.connection++;
    if (writable && (!this.lockManager || this.deferred))
      await this.restoreDrafts(true);
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === RESTORE || this.closed || this.refused) return;
    // Incoming collaboration packets are recorded directly from the wire, even
    // when applying one does not change a live document restored from disk.
    if (origin instanceof HocuspocusProvider) return;
    const key: DraftKey = [DRAFT, this.ydoc.guid, ++this.sequence];
    const draft = { key, update };
    this.pending.set(JSON.stringify(key), draft);
    this.unsent.push(draft);
    void write(this.db!, "custom", (tx) => {
      tx.objectStore("custom").put(update, key);
    }).catch(this.onWriteError);
  };

  outgoing({ message }: onOutgoingMessageParameters) {
    if (message.type !== MessageType.Sync) return;
    const decoder = createDecoder(message.toUint8Array());
    readVarString(decoder);
    readVarUint(decoder);
    if (readVarUint(decoder) === messageYjsUpdate)
      this.packets.push(this.unsent.splice(0));
  }

  incoming(message: onMessageParameters["message"], type: number) {
    if (this.closed || this.refused) return;
    try {
      if (type === MessageType.SyncStatus) {
        this.acknowledge();
      } else if (type === MessageType.Sync) {
        const subtype = message.readVarUint();
        if (subtype === messageYjsSyncStep1) {
          // The provider immediately answers a state-vector request with Step2.
          // Its acknowledgement covers exactly the drafts seen at this point.
          this.packets.push([...this.pending.values()]);
        } else if (
          subtype === messageYjsSyncStep2 ||
          subtype === messageYjsUpdate
        ) {
          this.saveConfirmed(message.readVarUint8Array(), []);
        }
      }
    } catch {
      this.onWriteError();
    }
  }

  disconnected() {
    this.connection++;
    this.packets = [];
    this.unsent = [];
  }

  private acknowledge() {
    const packet = this.packets.shift();
    if (this.closed || this.refused || !packet?.length) return;
    const drafts = packet.filter((draft) =>
      this.pending.has(JSON.stringify(draft.key)),
    );
    if (!drafts.length) return;
    this.saveConfirmed(Y.mergeUpdates(drafts.map((d) => d.update)), drafts);
  }

  private saveConfirmed(update: Uint8Array, drafts: Draft[]) {
    if (
      !drafts.length &&
      update.length === 2 &&
      update[0] === 0 &&
      update[1] === 0
    )
      return;
    // Only a committed transaction may remove the pending copy. Compaction
    // reads all confirmed records, including other tabs' writes, from disk.
    void write(this.db!, ["updates", "custom"], (tx) => {
      tx.objectStore("updates").add(update);
      for (const { key } of drafts) {
        tx.objectStore("custom").delete(key);
        tx.objectStore("custom").delete([WAIT_FOR_WRITE, key[1], key[2]]);
      }
    })
      .then(() => {
        for (const { key } of drafts) this.pending.delete(JSON.stringify(key));
        if (
          !this.closed &&
          !this.compacting &&
          ++this.writes >= COMPACT_AFTER
        ) {
          this.writes = 0;
          this.compacting = true;
          return compact(this.db!).finally(() => {
            this.compacting = false;
          });
        }
      })
      .catch(this.onWriteError);
  }

  markSynced() {
    if (!this.ydoc.getXmlFragment("default").length) {
      void write(this.db!, "custom", (tx) => {
        tx.objectStore("custom").put(1, EMPTY);
      }).catch(this.onWriteError);
    }
  }

  async discard(forgetPage = false): Promise<void> {
    this.refused = true;
    this.ydoc.off("update", this.onUpdate);
    refusalMarker(this.name, this.ydoc.guid, "set");
    await write(this.db!, ["updates", "custom"], (tx) => {
      for (const { key } of this.pending.values()) {
        // Even a closed tab may have unsent work. This room may discard only
        // its own edits. An inherited draft can be retried by an authorized writer.
        if (key[1] === this.ydoc.guid) tx.objectStore("custom").delete(key);
        else
          tx.objectStore("custom").put(true, [WAIT_FOR_WRITE, key[1], key[2]]);
      }
      if (forgetPage) {
        tx.objectStore("updates").clear();
        tx.objectStore("custom").delete(EMPTY);
      }
    });
    refusalMarker(this.name, this.ydoc.guid, "remove");
  }

  close() {
    this.closed = true;
    this.ydoc.off("update", this.onUpdate);
    this.releaseLocks();
    this.db?.close();
  }
}
