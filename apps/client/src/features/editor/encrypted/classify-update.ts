/**
 * Classifies a doc-changing editor transaction by its y-prosemirror sync
 * meta, mirroring the three places the library sets it:
 *
 * - `_forceRerender` (view init) dispatches the doc-replacing render with
 *   `{ isChangeOrigin: true, binding }` — the only dispatch that carries the
 *   binding. It is a render, not an edit: counting it would mark the doc
 *   dirty and fire a no-op save on every open.
 * - `_typeChanged` (genuine remote update) sets
 *   `{ isChangeOrigin: true, isUndoRedoOperation }` — no binding. Undo/redo
 *   flows through it too, which is why TipTap's own isChangeOrigin() would
 *   misclassify undo as remote; the flag has to be inspected directly.
 * - Local edits carry no sync meta at all.
 *
 * Kept as a pure function so the meta contract with the vendored
 * y-prosemirror can be pinned by unit tests.
 */
export type UpdateOrigin = 'initial-render' | 'remote' | 'local';

export function classifyUpdateOrigin(
  syncMeta:
    | {
        isChangeOrigin?: boolean;
        isUndoRedoOperation?: boolean;
        binding?: unknown;
      }
    | undefined,
): UpdateOrigin {
  if (syncMeta?.binding) {
    return 'initial-render';
  }
  if (syncMeta?.isChangeOrigin && !syncMeta.isUndoRedoOperation) {
    return 'remote';
  }
  return 'local';
}
