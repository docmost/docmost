import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { WebSocketEvent } from "@/features/websocket/types";

export type ApplyTreeEventOptions = {
  // Root-level entries in this tree aren't real hierarchy roots — they're
  // favorited-page shortcuts whose top-level presence/order is governed by
  // the favorites list, not by page structure. Set this for the favorites
  // tree so a generic move/insert event never restructures that top level
  // (e.g. moving a favorited page elsewhere in the real hierarchy must not
  // reorder or evict its shortcut) while still letting updates/deletes
  // apply normally, and letting moves/inserts affect nested descendants
  // revealed under a favorite.
  preserveRoots?: boolean;
};

// Applies a tree-affecting websocket/local event to a single tree array,
// returning the same reference when the event doesn't apply here (e.g. the
// node isn't loaded in this particular tree) so callers can treat the
// result as a no-op. Shared by every tree that renders SpaceTreeNode data
// (the main Pages tree and the Starred shortcuts tree) so a change made via
// either one is reflected in both.
export function applyTreeEvent(
  tree: SpaceTreeNode[],
  event: WebSocketEvent,
  opts?: ApplyTreeEventOptions,
): SpaceTreeNode[] {
  const preserveRoots = opts?.preserveRoots ?? false;

  switch (event.operation) {
    case "updateOne": {
      if (event.entity[0] !== "pages") return tree;
      if (!treeModel.find(tree, event.id)) return tree;
      let next = tree;
      if (event.payload?.title !== undefined) {
        next = treeModel.update(next, event.id, {
          name: event.payload.title,
        } as Partial<SpaceTreeNode>);
      }
      if (event.payload?.icon !== undefined) {
        next = treeModel.update(next, event.id, {
          icon: event.payload.icon,
        } as Partial<SpaceTreeNode>);
      }
      if (event.payload?.isBase !== undefined) {
        next = treeModel.update(next, event.id, {
          isBase: event.payload.isBase,
        } as Partial<SpaceTreeNode>);
      }
      return next;
    }

    case "addTreeNode": {
      const newParentId = event.payload.parentId as string | null;
      // A brand-new page is never automatically favorited — inserting it at
      // the favorites tree's top level would fabricate a shortcut for a page
      // nobody starred.
      if (preserveRoots && newParentId === null) return tree;
      if (treeModel.find(tree, event.payload.data.id)) return tree;
      let next = treeModel.insert(
        tree,
        newParentId,
        event.payload.data,
        event.payload.index,
      );
      if (next === tree) return tree;
      // Mirror the emitter: flip the new parent's hasChildren to true so the
      // chevron renders on the receiver.
      if (newParentId) {
        next = treeModel.update(next, newParentId, {
          hasChildren: true,
        } as Partial<SpaceTreeNode>);
      }
      return next;
    }

    case "moveTreeNode": {
      const newParentId = event.payload.parentId as string | null;
      if (preserveRoots) {
        // Becoming a real top-level page doesn't make it favorited.
        if (newParentId === null) return tree;
        // Don't let a favorited page's own real-hierarchy move reorder or
        // evict its root shortcut — that shortcut's position is governed by
        // the favorites list/position, not by where the real page lives.
        if (tree.some((n) => n.id === event.payload.id)) return tree;
      }

      const sourceBefore = treeModel.find(tree, event.payload.id);
      if (!sourceBefore) return tree;
      const oldParentId = (sourceBefore as SpaceTreeNode).parentPageId ?? null;

      const placed = treeModel.place(tree, event.payload.id, {
        parentId: newParentId,
        index: event.payload.index,
      });
      // `place` silently returns the same reference if the destination
      // parent isn't loaded in this tree. Falling back to removing the
      // source keeps the UI consistent (it reappears once the user expands
      // the new parent and lazy-load fetches it).
      if (placed === tree) {
        return treeModel.remove(tree, event.payload.id);
      }

      let next = treeModel.update(placed, event.payload.id, {
        position: event.payload.position,
        parentPageId: newParentId,
      } as Partial<SpaceTreeNode>);

      // Mirror the emitter's hasChildren bookkeeping so every tree converges
      // to the same chevron state.
      if (oldParentId) {
        const oldParent = treeModel.find(next, oldParentId);
        if (!oldParent?.children?.length) {
          next = treeModel.update(next, oldParentId, {
            hasChildren: false,
          } as Partial<SpaceTreeNode>);
        }
      }
      if (newParentId) {
        next = treeModel.update(next, newParentId, {
          hasChildren: true,
        } as Partial<SpaceTreeNode>);
      }

      return next;
    }

    case "deleteTreeNode": {
      if (!treeModel.find(tree, event.payload.node.id)) return tree;
      let next = treeModel.remove(tree, event.payload.node.id);
      // Mirror the emitter's hasChildren bookkeeping so every tree converges
      // to the same chevron state when the last child is deleted.
      const parentPageId = event.payload.node.parentPageId;
      if (parentPageId) {
        const parent = treeModel.find(next, parentPageId);
        if (!parent?.children?.length) {
          next = treeModel.update(next, parentPageId, {
            hasChildren: false,
          } as Partial<SpaceTreeNode>);
        }
      }
      return next;
    }

    default:
      return tree;
  }
}
