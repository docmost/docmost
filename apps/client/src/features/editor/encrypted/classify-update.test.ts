import { describe, expect, it } from "vitest";
import { classifyUpdateOrigin } from "./classify-update";

/**
 * Pins the meta contract with y-prosemirror (vendored, see
 * node_modules/y-prosemirror/src/plugins/sync-plugin.js). Each case mirrors
 * the exact meta the library dispatches. If a y-prosemirror upgrade changes
 * these shapes, these tests are the tripwire.
 */
describe("classifyUpdateOrigin", () => {
  it("ignores the initial _forceRerender (the doc-replacing render at view init)", () => {
    // ProsemirrorBinding._forceRerender:
    //   tr.setMeta(ySyncPluginKey, { isChangeOrigin: true, binding: this })
    expect(
      classifyUpdateOrigin({ isChangeOrigin: true, binding: {} }),
    ).toBe("initial-render");
  });

  it("classifies a genuine remote update as remote", () => {
    // ProsemirrorBinding._typeChanged:
    //   tr.setMeta(ySyncPluginKey, { isChangeOrigin: true,
    //     isUndoRedoOperation: transaction.origin instanceof Y.UndoManager })
    expect(
      classifyUpdateOrigin({
        isChangeOrigin: true,
        isUndoRedoOperation: false,
      }),
    ).toBe("remote");
  });

  it("classifies undo/redo as local, not remote", () => {
    // undo/redo also flows through _typeChanged with isChangeOrigin: true —
    // treating it as remote would skip the local dirty-tracking for an edit
    // this client made
    expect(
      classifyUpdateOrigin({
        isChangeOrigin: true,
        isUndoRedoOperation: true,
      }),
    ).toBe("local");
  });

  it("classifies a plain typed edit (no sync meta) as local", () => {
    expect(classifyUpdateOrigin(undefined)).toBe("local");
  });

  it("does not let a falsy binding mask a remote update", () => {
    expect(
      classifyUpdateOrigin({
        isChangeOrigin: true,
        isUndoRedoOperation: false,
        binding: undefined,
      }),
    ).toBe("remote");
  });
});
