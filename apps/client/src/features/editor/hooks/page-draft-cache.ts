import {
  HocuspocusProvider,
  MessageType,
  type onMessageParameters,
} from "@hocuspocus/provider";
import { messageYjsSyncStep2, messageYjsUpdate } from "y-protocols/sync";
import * as Y from "yjs";
import { fromBase64, toBase64 } from "lib0/buffer";
import { failedPageWrites } from "@/lib/local-page-data";

// Keep the y-indexeddb store layout. Only server-confirmed updates go in
// "updates". Individual drafts stay in "custom" until their packet is acknowledged.
const COMPACT_AFTER = 500;
const DRAFT = "draft";
const WAIT_FOR_WRITE = "draft-requires-write";
const EMPTY = "empty-page-synced";
const RECOVERY = "refused-copy";
const RESTORE = Symbol("restore page");
type DraftKey = [string, string, number];
type Draft = { key: DraftKey; update: Uint8Array; backedUp?: boolean };

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
      const confirmed = new Y.Doc();
      let merged: Uint8Array;
      try {
        Y.applyUpdate(confirmed, Y.mergeUpdates(updates));
        merged = Y.encodeStateAsUpdate(confirmed);
      } finally {
        confirmed.destroy();
      }
      store.clear();
      store.add(merged);
    }
  });
}

export class PageDraftCache {
  readonly ydoc = new Y.Doc();
  private readonly name: string;
  private db: IDBDatabase | null = null;
  private readonly pending = new Map<string, Draft>();
  private readonly owned = new Set<string>();
  private writable = false;
  private readonly failed = new Set<Draft>();
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
  private writerLock?: Promise<boolean>;
  private lockManager: LockManager | undefined;

  constructor(
    pageId: string,
    userId: string,
    private onWriteError: () => void,
    private canReplayDrafts: () => boolean = () => true,
  ) {
    this.name = `page.${pageId}.user.${userId}`;
    try {
      this.lockManager = navigator.locks;
    } catch {
      /* Storage may be blocked. */
    }
  }

  get opened() {
    return this.db !== null;
  }

  get hasPending() {
    return this.pending.size > 0;
  }

  useBackupStorage() {
    this.writerLock = this.claim(this.ydoc.guid);
    this.ydoc.on("update", this.onUpdate);
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
    // Previous versions stored page.<id> without a writer identity. Leave that
    // database intact. Only account-scoped records can join this room.
    await this.claim(this.ydoc.guid);
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
    const backupKeys = failedPageWrites.read(this.name);
    const diskKeys =
      this.db && (this.lockManager || writeAuthorized) && this.canReplayDrafts()
        ? await result(
            this.db!.transaction("custom")
              .objectStore("custom")
              .getAllKeys(IDBKeyRange.bound([DRAFT], [DRAFT, []])),
          )
        : [];
    const keys = new Map<string, DraftKey>();
    if ((this.lockManager || writeAuthorized) && this.canReplayDrafts()) {
      for (const value of diskKeys)
        keys.set(JSON.stringify(value), value as DraftKey);
      for (const key of backupKeys.keys())
        keys.set(key, JSON.parse(key) as DraftKey);
    }
    const owners = new Set(Array.from(keys.values(), (key) => key[1]));
    const claimed = new Set<string>();
    await Promise.all(
      Array.from(owners, async (owner) => {
        if (
          owner === "legacy" ||
          owner === this.ydoc.guid ||
          (this.lockManager && !(await this.claim(owner))) ||
          this.closed
        )
          return;
        if (refusalMarker(this.name, owner, "get")) {
          if (this.db)
            await write(this.db, "custom", (tx) => {
              tx.objectStore("custom").delete(
                IDBKeyRange.bound([DRAFT, owner], [DRAFT, owner, []]),
              );
            });
          for (const [id, key] of keys) {
            if (key[1] === owner && backupKeys.has(id))
              failedPageWrites.remove(this.name, id);
          }
          if (this.db) refusalMarker(this.name, owner, "remove");
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
    const snapshot = this.db?.transaction(
      includeConfirmed ? ["custom", "updates"] : ["custom"],
    );
    const fresh = snapshot?.objectStore("custom");
    const backups = backupKeys.size
      ? failedPageWrites.read(this.name)
      : backupKeys;
    const [confirmed, empty, drafts] = await Promise.all([
      includeConfirmed && snapshot
        ? result<Uint8Array[]>(snapshot.objectStore("updates").getAll())
        : [],
      includeConfirmed && fresh ? result(fresh.get(EMPTY)) : undefined,
      Promise.all(
        Array.from(keys, async ([id, key]) => {
          if (!claimed.has(key[1])) return;
          const [stored, needsGrant] = await Promise.all([
            fresh && result<Uint8Array | undefined>(fresh.get(key)),
            fresh && result(fresh.get([WAIT_FOR_WRITE, key[1], key[2]])),
          ]);
          if (needsGrant && !writeAuthorized) return;
          const backup = backups.get(id);
          const update = stored ?? (backup && fromBase64(backup));
          if (update)
            return { key, update, backedUp: Boolean(backup) } as Draft;
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
        !!draft &&
        this.canReplayDrafts() &&
        !this.pending.has(JSON.stringify(draft.key)),
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
    this.writable = writable;
    await this.resumeDrafts();
  }

  async resumeDrafts() {
    await this.writerLock;
    if (this.writable && this.canReplayDrafts()) await this.restoreDrafts(true);
  }

  private appendDraft(draft: Draft) {
    const keepBackup = () => {
      draft.backedUp = true;
      failedPageWrites.keep(
        this.name,
        JSON.stringify(draft.key),
        toBase64(draft.update),
      );
    };
    if (!this.db) {
      keepBackup();
      return;
    }
    const retry = [...this.failed];
    void write(this.db!, "custom", (tx) => {
      const store = tx.objectStore("custom");
      for (const previous of retry) store.put(previous.update, previous.key);
      store.put(draft.update, draft.key);
    })
      .then(() => {
        for (const previous of retry) this.clearBackup(previous);
      })
      .catch(() => {
        if (this.refused) return;
        this.failed.add(draft);
        keepBackup();
        this.onWriteError();
      });
  }

  private clearBackup(draft: Draft) {
    if (!draft.backedUp) return;
    failedPageWrites.remove(this.name, JSON.stringify(draft.key));
    this.failed.delete(draft);
    draft.backedUp = false;
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
    this.appendDraft(draft);
  };

  withholdBatch() {
    // Acknowledgements track transmitted packets. The journal still owns
    // these edits until a later state-vector handshake includes them.
    this.unsent = [];
  }

  sent(subtype: number, included: boolean) {
    if (!included) this.packets.push([]);
    else if (subtype === messageYjsSyncStep2)
      this.packets.push([...this.pending.values()]);
    else if (subtype === messageYjsUpdate)
      this.packets.push(this.unsent.splice(0));
  }

  incoming(message: onMessageParameters["message"], type: number) {
    if (this.closed || this.refused) return;
    try {
      if (type === MessageType.SyncStatus) {
        this.acknowledge();
      } else if (type === MessageType.Sync) {
        const subtype = message.readVarUint();
        if (subtype === messageYjsSyncStep2 || subtype === messageYjsUpdate) {
          this.saveConfirmed(message.readVarUint8Array(), []);
        }
      }
    } catch {
      this.onWriteError();
    }
  }

  disconnected() {
    this.connection++;
    this.writable = false;
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
    if (!this.db) {
      for (const draft of drafts) {
        this.clearBackup(draft);
        this.pending.delete(JSON.stringify(draft.key));
      }
      return;
    }
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
        for (const draft of drafts) {
          this.clearBackup(draft);
          this.pending.delete(JSON.stringify(draft.key));
        }
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
    if (this.db && !this.ydoc.getXmlFragment("default").length) {
      void write(this.db!, "custom", (tx) => {
        tx.objectStore("custom").put(1, EMPTY);
      }).catch(this.onWriteError);
    }
  }

  async discard(forgetPage = false): Promise<void> {
    // Keep the rejected writer's local copy outside the updates that can sync.
    const copy =
      !forgetPage && this.hasPending
        ? {
            id: this.ydoc.guid,
            createdAt: Date.now(),
            update: Y.encodeStateAsUpdate(this.ydoc),
          }
        : undefined;
    this.refused = true;
    this.ydoc.off("update", this.onUpdate);
    refusalMarker(this.name, this.ydoc.guid, "set");
    const recovery = this.name + ".recovery";
    const copyKey = copy && `${copy.id}:${copy.createdAt}`;
    if (forgetPage) {
      for (const key of failedPageWrites.read(recovery).keys())
        failedPageWrites.remove(recovery, key);
    } else if (copy) {
      failedPageWrites.keep(recovery, copyKey, toBase64(copy.update));
    }
    if (this.db)
      await write(this.db, ["updates", "custom"], (tx) => {
        const custom = tx.objectStore("custom");
        if (copy) custom.put(copy, [RECOVERY, copy.id]);
        for (const { key } of this.pending.values()) {
          // Even a closed tab may have unsent work. This room may discard only
          // its own edits. An inherited draft can be retried by an authorized writer.
          if (key[1] === this.ydoc.guid) tx.objectStore("custom").delete(key);
          else
            tx.objectStore("custom").put(true, [
              WAIT_FOR_WRITE,
              key[1],
              key[2],
            ]);
        }
        if (forgetPage) {
          tx.objectStore("updates").clear();
          custom.delete(EMPTY);
          custom.delete(IDBKeyRange.bound([RECOVERY], [RECOVERY, []]));
        }
      });
    for (const draft of this.pending.values()) {
      if (draft.key[1] === this.ydoc.guid) this.clearBackup(draft);
    }
    if (this.db) {
      if (copyKey) failedPageWrites.remove(recovery, copyKey);
      refusalMarker(this.name, this.ydoc.guid, "remove");
    }
  }

  close() {
    this.closed = true;
    this.ydoc.off("update", this.onUpdate);
    this.releaseLocks();
    this.db?.close();
  }
}
