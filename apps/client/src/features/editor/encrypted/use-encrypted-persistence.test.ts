import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  authorsOfTransaction,
  CAN_EDIT_FIELD,
  electSaver,
} from "@/features/editor/encrypted/use-encrypted-persistence";
import { RELAY_ORIGIN } from "@/features/encryption/services/sync-origins";

/**
 * Every peer sees every remote edit. Without an election each of them would
 * arm the durability-fallback save, and one burst of typing would produce a
 * write per peer, each racing the others into a version conflict, a refetch,
 * a decrypt and a merge. Every peer must reach the same answer from the
 * awareness state they already share.
 */
function peer(clientID: number, canEdit: boolean) {
  const doc = new Y.Doc();
  // clientID is normally random; fix it so the election is deterministic
  (doc as any).clientID = clientID;
  const awareness = new Awareness(doc);
  awareness.setLocalStateField(CAN_EDIT_FIELD, canEdit);
  return { doc, awareness };
}

/** merge everyone's local state into one awareness view, as the relay does */
function sharedAwareness(
  peers: { clientID: number; canEdit: boolean }[],
): Awareness {
  const { awareness } = peer(peers[0].clientID, peers[0].canEdit);
  for (const p of peers.slice(1)) {
    awareness.states.set(p.clientID, { [CAN_EDIT_FIELD]: p.canEdit });
  }
  return awareness;
}

describe("electSaver", () => {
  it("elects the lowest client id among peers that can write", () => {
    const awareness = sharedAwareness([
      { clientID: 10, canEdit: true },
      { clientID: 3, canEdit: true },
      { clientID: 25, canEdit: true },
    ]);

    expect(electSaver(awareness, 3)).toBe(true);
    expect(electSaver(awareness, 10)).toBe(false);
    expect(electSaver(awareness, 25)).toBe(false);
  });

  it("elects exactly one saver, whoever is asking", () => {
    const ids = [7, 2, 19, 4];
    const awareness = sharedAwareness(
      ids.map((clientID) => ({ clientID, canEdit: true })),
    );

    const elected = ids.filter((id) => electSaver(awareness, id));
    expect(elected).toEqual([2]);
  });

  it("ignores viewers, who cannot save at all", () => {
    // a viewer with a lower id must not win the election and leave nobody
    // actually able to persist the fallback
    const awareness = sharedAwareness([
      { clientID: 8, canEdit: true },
      { clientID: 1, canEdit: false },
    ]);

    expect(electSaver(awareness, 8)).toBe(true);
  });

  it("elects the only editor present", () => {
    const awareness = sharedAwareness([{ clientID: 42, canEdit: true }]);
    expect(electSaver(awareness, 42)).toBe(true);
  });

  // The regression this guards: electing the author leaves nobody standing by
  // for it. The author saves its own work ~800ms after typing, so the fallback
  // only earns its keep when a *different* client holds it — otherwise an
  // author whose tab dies before that save takes the edit down with it, even
  // though every peer has it in memory.
  it("does not elect the author of the edit, even when it has the lowest id", () => {
    const peers = [
      { clientID: 2, canEdit: true },
      { clientID: 9, canEdit: true },
      { clientID: 14, canEdit: true },
    ];
    const awareness = sharedAwareness(peers);
    const author = new Set([2]);

    expect(electSaver(awareness, 2, author)).toBe(false);
    // the next-lowest writer covers for them
    expect(electSaver(awareness, 9, author)).toBe(true);
    expect(electSaver(awareness, 14, author)).toBe(false);
  });

  it("still elects exactly one peer when several clients co-authored an edit", () => {
    const ids = [3, 5, 11, 20];
    const awareness = sharedAwareness(
      ids.map((clientID) => ({ clientID, canEdit: true })),
    );
    const authors = new Set([3, 5]);

    const elected = ids.filter((id) => electSaver(awareness, id, authors));
    expect(elected).toEqual([11]);
  });

  it("elects nobody when the only writer is the author", () => {
    // a lone editor needs no fallback: its own debounced save is the only
    // durability path, and there is no peer that could stand in for it
    const awareness = sharedAwareness([{ clientID: 4, canEdit: true }]);
    expect(electSaver(awareness, 4, new Set([4]))).toBe(false);
  });

  /**
   * The election is only as good as *when* it learns who authored the edit.
   *
   * Yjs fires beforeObserverCalls → type observers → afterTransaction →
   * update, and y-prosemirror drives the editor's onUpdate (and so the
   * election) from the type-observer phase. Capturing authors from the
   * 'update' event therefore reads one edit too late: on the first remote edit
   * of a session it knows nobody, so the author itself wins the election and
   * no peer stands by for it — the exact failure the election was added to
   * prevent. This wires the two together the way the hook does and checks the
   * answer at the moment the hook actually asks.
   */
  it("knows the author by the time the editor reacts to a remote edit", () => {
    const author = new Y.Doc();
    (author as any).clientID = 101;
    const peer = new Y.Doc();
    (peer as any).clientID = 202;

    author.getText("body").insert(0, "shared");
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(author));

    const awareness = sharedAwareness([
      { clientID: 101, canEdit: true },
      { clientID: 202, canEdit: true },
    ]);

    // mirrors the hook: authors captured on beforeObserverCalls...
    let capturedAuthors = new Set<number>();
    peer.on("beforeObserverCalls", (transaction: Y.Transaction) => {
      if (transaction.origin === RELAY_ORIGIN) {
        capturedAuthors = authorsOfTransaction(transaction);
      }
    });

    // ...and read from the observer phase, where onUpdate/onRemoteEdit run
    let electedAtObserver: boolean | null = null;
    peer.getText("body").observeDeep(() => {
      electedAtObserver = electSaver(awareness, 202, capturedAuthors);
    });

    author.getText("body").insert(6, " edit");
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(author), RELAY_ORIGIN);

    expect([...capturedAuthors]).toEqual([101]);
    // the author has the lower id, so without exclusion it would have won the
    // election and left this peer standing by for nobody
    expect(electedAtObserver).toBe(true);
  });

  it("re-elects a survivor once the author leaves", () => {
    // what the awareness-change re-election does: with the author gone from
    // the state map, the lowest remaining writer picks the work up
    const awareness = sharedAwareness([
      { clientID: 6, canEdit: true },
      { clientID: 13, canEdit: true },
    ]);
    awareness.states.delete(6);

    expect(electSaver(awareness, 13)).toBe(true);
  });
});
