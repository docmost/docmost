import type { TreeNode, SiblingsInfo } from './tree-model.types';

function findInternal<T extends object>(
  nodes: TreeNode<T>[],
  id: string,
): { parents: TreeNode<T>[]; node: TreeNode<T> } | null {
  for (const node of nodes) {
    if (node.id === id) return { parents: [], node };
    if (node.children) {
      const inner = findInternal(node.children, id);
      if (inner) return { parents: [node, ...inner.parents], node: inner.node };
    }
  }
  return null;
}

// Ids are UUIDs, which can't contain this character — safe as a join
// separator with zero real-world collision risk.
const PATH_KEY_SEPARATOR = '\u0000';

// Joins an ancestor-id chain (root..node) into a single string identity for
// a specific tree position. Used by trees where the same id can legitimately
// appear more than once (e.g. a page that's independently favorited AND a
// descendant of another favorited page) — keying by path instead of bare id
// lets each occurrence carry independent open/selected/focus state instead
// of colliding on one shared id.
export function pathKey(path: string[]): string {
  return path.join(PATH_KEY_SEPARATOR);
}

function findByPathInternal<T extends object>(
  nodes: TreeNode<T>[] | undefined,
  path: string[],
): TreeNode<T> | null {
  let found: TreeNode<T> | null = null;
  let level = nodes;
  for (const id of path) {
    found = level?.find((n) => n.id === id) ?? null;
    if (!found) return null;
    level = found.children;
  }
  return found;
}

function appendChildrenByPathInternal<T extends object>(
  nodes: TreeNode<T>[],
  path: string[],
  children: TreeNode<T>[],
): TreeNode<T>[] {
  if (path.length === 0) return nodes;
  const [id, ...rest] = path;
  let touched = false;
  const out = nodes.map((n) => {
    if (n.id !== id) return n;
    if (rest.length === 0) {
      const existing = n.children ?? [];
      const existingIds = new Set(existing.map((c) => c.id));
      const fresh = children.filter((c) => !existingIds.has(c.id));
      if (fresh.length === 0) return n;
      touched = true;
      return { ...n, children: [...existing, ...fresh] };
    }
    const next = appendChildrenByPathInternal(n.children ?? [], rest, children);
    if (next === n.children) return n;
    touched = true;
    return { ...n, children: next };
  });
  return touched ? out : nodes;
}

export const treeModel = {
  find<T extends object>(tree: TreeNode<T>[], id: string): TreeNode<T> | null {
    return findInternal(tree, id)?.node ?? null;
  },

  path<T extends object>(tree: TreeNode<T>[], id: string): TreeNode<T>[] | null {
    const found = findInternal(tree, id);
    if (!found) return null;
    return [...found.parents, found.node];
  },

  siblingsOf<T extends object>(
    tree: TreeNode<T>[],
    id: string,
  ): SiblingsInfo<T> | null {
    const found = findInternal(tree, id);
    if (!found) return null;
    const parent = found.parents[found.parents.length - 1];
    const siblings = parent ? parent.children! : tree;
    return {
      parentId: parent?.id ?? null,
      siblings,
      index: siblings.findIndex((n) => n.id === id),
    };
  },

  isDescendant<T extends object>(
    tree: TreeNode<T>[],
    ancestorId: string,
    descendantId: string,
  ): boolean {
    if (ancestorId === descendantId) return false;
    const ancestor = treeModel.find(tree, ancestorId);
    if (!ancestor?.children) return false;
    return findInternal(ancestor.children, descendantId) !== null;
  },

  visible<T extends object>(
    tree: TreeNode<T>[],
    openIds: ReadonlySet<string>,
  ): TreeNode<T>[] {
    const out: TreeNode<T>[] = [];
    const walk = (nodes: TreeNode<T>[]) => {
      for (const node of nodes) {
        out.push(node);
        if (openIds.has(node.id) && node.children?.length) walk(node.children);
      }
    };
    walk(tree);
    return out;
  },

  // Path-aware variant of `visible` for trees where openIds/openKeys are
  // keyed by pathKey(...) rather than bare id (see pathKey above) — needed
  // whenever the same id can occupy more than one row.
  visibleByPath<T extends object>(
    tree: TreeNode<T>[],
    openKeys: ReadonlySet<string>,
  ): TreeNode<T>[] {
    const out: TreeNode<T>[] = [];
    const walk = (nodes: TreeNode<T>[], parentPath: string[]) => {
      for (const node of nodes) {
        const path = [...parentPath, node.id];
        out.push(node);
        if (openKeys.has(pathKey(path)) && node.children?.length) {
          walk(node.children, path);
        }
      }
    };
    walk(tree, []);
    return out;
  },

  // Path-aware variant of `find` — locates the exact occurrence at `path`
  // (root..node id chain) rather than the first node matching a bare id.
  findByPath<T extends object>(
    tree: TreeNode<T>[],
    path: string[],
  ): TreeNode<T> | null {
    return findByPathInternal(tree, path);
  },

  // Path-aware variant of `appendChildren` — targets the exact occurrence at
  // `path` so lazily-loaded children land on the row the user actually
  // toggled, not just the first node sharing its id.
  appendChildrenByPath<T extends object>(
    tree: TreeNode<T>[],
    path: string[],
    children: TreeNode<T>[],
  ): TreeNode<T>[] {
    return appendChildrenByPathInternal(tree, path, children);
  },

  insert<T extends object>(
    tree: TreeNode<T>[],
    parentId: string | null,
    node: TreeNode<T>,
    index?: number,
  ): TreeNode<T>[] {
    if (parentId === null) {
      const idx = index ?? tree.length;
      return [...tree.slice(0, idx), node, ...tree.slice(idx)];
    }
    let touched = false;
    const walk = (nodes: TreeNode<T>[]): TreeNode<T>[] =>
      nodes.map((n) => {
        if (n.id === parentId) {
          touched = true;
          const kids = n.children ?? [];
          const idx = index ?? kids.length;
          return {
            ...n,
            children: [...kids.slice(0, idx), node, ...kids.slice(idx)],
          };
        }
        if (n.children) {
          const next = walk(n.children);
          if (next !== n.children) return { ...n, children: next };
        }
        return n;
      });
    const out = walk(tree);
    return touched ? out : tree;
  },

  remove<T extends object>(tree: TreeNode<T>[], id: string): TreeNode<T>[] {
    let touched = false;
    const walk = (nodes: TreeNode<T>[]): TreeNode<T>[] => {
      const filtered = nodes.filter((n) => {
        if (n.id === id) {
          touched = true;
          return false;
        }
        return true;
      });
      return filtered.map((n) => {
        if (n.children) {
          const next = walk(n.children);
          if (next !== n.children) return { ...n, children: next };
        }
        return n;
      });
    };
    const out = walk(tree);
    return touched ? out : tree;
  },

  // `patch` excludes `id` (immutable) and `children` (use insert / remove /
  // appendChildren for structural changes — otherwise referential identity of
  // unrelated subtrees gets blown away).
  update<T extends object>(
    tree: TreeNode<T>[],
    id: string,
    patch: Omit<Partial<T>, "id" | "children">,
  ): TreeNode<T>[] {
    let touched = false;
    const walk = (nodes: TreeNode<T>[]): TreeNode<T>[] =>
      nodes.map((n) => {
        if (n.id === id) {
          touched = true;
          return { ...n, ...patch };
        }
        if (n.children) {
          const next = walk(n.children);
          if (next !== n.children) return { ...n, children: next };
        }
        return n;
      });
    const out = walk(tree);
    return touched ? out : tree;
  },

  appendChildren<T extends object>(
    tree: TreeNode<T>[],
    parentId: string,
    children: TreeNode<T>[],
  ): TreeNode<T>[] {
    let touched = false;
    const walk = (nodes: TreeNode<T>[]): TreeNode<T>[] =>
      nodes.map((n) => {
        if (n.id === parentId) {
          const existing = n.children ?? [];
          // Dedup against existing ids — auto-expand + manual toggle can race
          // and produce overlapping fetches; we don't want React to see two
          // children with the same key.
          const existingIds = new Set(existing.map((c) => c.id));
          const fresh = children.filter((c) => !existingIds.has(c.id));
          if (fresh.length === 0) return n;
          touched = true;
          return { ...n, children: [...existing, ...fresh] };
        }
        if (n.children) {
          const next = walk(n.children);
          if (next !== n.children) return { ...n, children: next };
        }
        return n;
      });
    const out = walk(tree);
    return touched ? out : tree;
  },

  place<T extends object>(
    tree: TreeNode<T>[],
    sourceId: string,
    to: { parentId: string | null; index: number },
  ): TreeNode<T>[] {
    const source = treeModel.find(tree, sourceId);
    if (!source) return tree;
    if (to.parentId !== null && !treeModel.find(tree, to.parentId)) return tree;
    const removed = treeModel.remove(tree, sourceId);
    return treeModel.insert(removed, to.parentId, source, to.index);
  },

  move<T extends object>(
    tree: TreeNode<T>[],
    sourceId: string,
    op: import('./tree-model.types').DropOp,
  ): { tree: TreeNode<T>[]; result: import('./tree-model.types').DropResult } {
    if (sourceId === op.targetId) return { tree, result: { parentId: null, index: 0 } };
    if (!treeModel.find(tree, sourceId) || !treeModel.find(tree, op.targetId)) {
      return { tree, result: { parentId: null, index: 0 } };
    }
    if (treeModel.isDescendant(tree, sourceId, op.targetId)) {
      return { tree, result: { parentId: null, index: 0 } };
    }

    let parentId: string | null;
    let index: number;

    if (op.kind === 'make-child') {
      parentId = op.targetId;
      const target = treeModel.find(tree, op.targetId)!;
      index = target.children?.length ?? 0;
    } else {
      const info = treeModel.siblingsOf(tree, op.targetId)!;
      parentId = info.parentId;
      const sourceInfo = treeModel.siblingsOf(tree, sourceId)!;
      const sameParent = sourceInfo.parentId === parentId;
      const adjust =
        sameParent && sourceInfo.index < info.index ? -1 : 0;
      index = info.index + adjust + (op.kind === 'reorder-after' ? 1 : 0);
    }

    const next = treeModel.place(tree, sourceId, { parentId, index });
    return { tree: next, result: { parentId, index } };
  },
};
