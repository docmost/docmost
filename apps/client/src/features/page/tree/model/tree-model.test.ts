import { describe, it, expect } from 'vitest';
import { treeModel } from './tree-model';
import type { TreeNode } from './tree-model.types';

type N = TreeNode<{ name: string }>;

const fixture: N[] = [
  {
    id: 'a',
    name: 'A',
    children: [
      { id: 'a1', name: 'A1', children: [{ id: 'a1a', name: 'A1a' }] },
      { id: 'a2', name: 'A2' },
    ],
  },
  { id: 'b', name: 'B' },
];

describe('treeModel.find', () => {
  it('finds a root node', () => {
    expect(treeModel.find(fixture, 'a')?.name).toBe('A');
  });
  it('finds a deeply nested node', () => {
    expect(treeModel.find(fixture, 'a1a')?.name).toBe('A1a');
  });
  it('returns null for unknown id', () => {
    expect(treeModel.find(fixture, 'zzz')).toBeNull();
  });
});

describe('treeModel.path', () => {
  it('returns root-to-leaf path for nested id', () => {
    const p = treeModel.path(fixture, 'a1a');
    expect(p?.map((n) => n.id)).toEqual(['a', 'a1', 'a1a']);
  });
  it('returns [node] for root-level id', () => {
    expect(treeModel.path(fixture, 'b')?.map((n) => n.id)).toEqual(['b']);
  });
  it('returns null for unknown id', () => {
    expect(treeModel.path(fixture, 'zzz')).toBeNull();
  });
});

describe('treeModel.siblingsOf', () => {
  it('returns siblings + parent + index for a child', () => {
    const info = treeModel.siblingsOf(fixture, 'a2');
    expect(info?.parentId).toBe('a');
    expect(info?.siblings.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(info?.index).toBe(1);
  });
  it('returns parentId null + root siblings for a root id', () => {
    const info = treeModel.siblingsOf(fixture, 'b');
    expect(info?.parentId).toBeNull();
    expect(info?.siblings.map((n) => n.id)).toEqual(['a', 'b']);
    expect(info?.index).toBe(1);
  });
  it('returns null for unknown id', () => {
    expect(treeModel.siblingsOf(fixture, 'zzz')).toBeNull();
  });
});

describe('treeModel.isDescendant', () => {
  it('returns true when descendantId is nested under ancestorId', () => {
    expect(treeModel.isDescendant(fixture, 'a', 'a1a')).toBe(true);
  });
  it('returns false when ids are siblings', () => {
    expect(treeModel.isDescendant(fixture, 'a1', 'a2')).toBe(false);
  });
  it('returns false when ancestorId is the same as descendantId', () => {
    expect(treeModel.isDescendant(fixture, 'a', 'a')).toBe(false);
  });
  it('returns false for unknown ids', () => {
    expect(treeModel.isDescendant(fixture, 'zzz', 'a')).toBe(false);
  });
});

describe('treeModel.visible', () => {
  it('returns only root nodes when no openIds', () => {
    const v = treeModel.visible(fixture, new Set());
    expect(v.map((n) => n.id)).toEqual(['a', 'b']);
  });
  it('includes children of open ids in DFS order', () => {
    const v = treeModel.visible(fixture, new Set(['a']));
    expect(v.map((n) => n.id)).toEqual(['a', 'a1', 'a2', 'b']);
  });
  it('recursively descends through chains of open ids', () => {
    const v = treeModel.visible(fixture, new Set(['a', 'a1']));
    expect(v.map((n) => n.id)).toEqual(['a', 'a1', 'a1a', 'a2', 'b']);
  });
  it('ignores openIds that are not in the tree', () => {
    const v = treeModel.visible(fixture, new Set(['ghost']));
    expect(v.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('treeModel.insert', () => {
  const leaf = (id: string): N => ({ id, name: id.toUpperCase() });

  it('inserts at end when index is undefined', () => {
    const t = treeModel.insert(fixture, 'a', leaf('a3'));
    expect(treeModel.siblingsOf(t, 'a3')?.siblings.map((n) => n.id)).toEqual([
      'a1', 'a2', 'a3',
    ]);
  });
  it('inserts at index 0', () => {
    const t = treeModel.insert(fixture, 'a', leaf('a0'), 0);
    expect(treeModel.siblingsOf(t, 'a0')?.siblings.map((n) => n.id)).toEqual([
      'a0', 'a1', 'a2',
    ]);
  });
  it('inserts in the middle', () => {
    const t = treeModel.insert(fixture, 'a', leaf('a1half'), 1);
    expect(
      treeModel.siblingsOf(t, 'a1half')?.siblings.map((n) => n.id),
    ).toEqual(['a1', 'a1half', 'a2']);
  });
  it('inserts at root when parentId is null', () => {
    const t = treeModel.insert(fixture, null, leaf('c'));
    expect(t.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });
  it('returns same array reference for unknown parentId', () => {
    const t = treeModel.insert(fixture, 'ghost', leaf('zz'));
    expect(t).toBe(fixture);
  });
  it('initializes children array when parent had no children', () => {
    const t = treeModel.insert(fixture, 'b', leaf('b1'));
    expect(treeModel.find(t, 'b')?.children?.map((n) => n.id)).toEqual(['b1']);
  });
});

describe('treeModel.remove', () => {
  it('removes a leaf', () => {
    const t = treeModel.remove(fixture, 'a2');
    expect(treeModel.find(t, 'a2')).toBeNull();
  });
  it('removes a subtree', () => {
    const t = treeModel.remove(fixture, 'a1');
    expect(treeModel.find(t, 'a1')).toBeNull();
    expect(treeModel.find(t, 'a1a')).toBeNull();
  });
  it('removes a root node', () => {
    const t = treeModel.remove(fixture, 'b');
    expect(t.map((n) => n.id)).toEqual(['a']);
  });
  it('returns same array reference for unknown id', () => {
    expect(treeModel.remove(fixture, 'ghost')).toBe(fixture);
  });
});

describe('treeModel.update', () => {
  it('shallow-merges a patch on the matching node', () => {
    const t = treeModel.update(fixture, 'a1', { name: 'A1-renamed' });
    expect(treeModel.find(t, 'a1')?.name).toBe('A1-renamed');
  });
  it('returns same array reference for unknown id', () => {
    expect(treeModel.update(fixture, 'ghost', { name: 'x' })).toBe(fixture);
  });
  it("preserves children when patching parent's own fields", () => {
    const t = treeModel.update(fixture, 'a', { name: 'A-renamed' });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a1', 'a2',
    ]);
  });
  it('preserves reference identity of unrelated subtrees', () => {
    const t = treeModel.update(fixture, 'a1', { name: 'X' });
    expect(t[1]).toBe(fixture[1]);
  });
});

describe('treeModel.appendChildren', () => {
  const kid = (id: string): N => ({ id, name: id });

  it('appends to existing children', () => {
    const t = treeModel.appendChildren(fixture, 'a', [kid('a3'), kid('a4')]);
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a1', 'a2', 'a3', 'a4',
    ]);
  });
  it('initializes children when parent had none', () => {
    const t = treeModel.appendChildren(fixture, 'b', [kid('b1')]);
    expect(treeModel.find(t, 'b')?.children?.map((n) => n.id)).toEqual(['b1']);
  });
  it('returns same array reference for unknown parentId', () => {
    expect(treeModel.appendChildren(fixture, 'ghost', [kid('zz')])).toBe(
      fixture,
    );
  });

  // Regression: lazy-load + auto-expand can race and call appendChildren with
  // children that overlap what's already there. React then crashes on duplicate
  // keys. Defensive dedup at the model level.
  it('dedups against existing children by id', () => {
    const t1 = treeModel.appendChildren(fixture, 'a', [
      kid('a3'),
      kid('a4'),
    ]);
    const t2 = treeModel.appendChildren(t1, 'a', [
      kid('a3'),
      kid('a4'),
      kid('a5'),
    ]);
    expect(treeModel.find(t2, 'a')?.children?.map((n) => n.id)).toEqual([
      'a1', 'a2', 'a3', 'a4', 'a5',
    ]);
  });

  it('returns same array reference when every child is a duplicate', () => {
    const t1 = treeModel.appendChildren(fixture, 'a', [kid('a3')]);
    const t2 = treeModel.appendChildren(t1, 'a', [kid('a3')]);
    expect(t2).toBe(t1);
  });
});

describe('treeModel.place', () => {
  it('moves a node to a new parent at a given index', () => {
    const t = treeModel.place(fixture, 'a2', { parentId: 'b', index: 0 });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual(['a1']);
    expect(treeModel.find(t, 'b')?.children?.map((n) => n.id)).toEqual(['a2']);
  });
  it('moves a node to root', () => {
    const t = treeModel.place(fixture, 'a1', { parentId: null, index: 0 });
    expect(t.map((n) => n.id)).toEqual(['a1', 'a', 'b']);
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual(['a2']);
  });
  it('reorders within the same parent', () => {
    const t = treeModel.place(fixture, 'a2', { parentId: 'a', index: 0 });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a2', 'a1',
    ]);
  });
  it('returns same array reference for unknown source', () => {
    expect(
      treeModel.place(fixture, 'ghost', { parentId: 'a', index: 0 }),
    ).toBe(fixture);
  });
  it('returns same array reference for unknown destination parent', () => {
    expect(
      treeModel.place(fixture, 'a1', { parentId: 'ghost', index: 0 }),
    ).toBe(fixture);
  });
});

describe('treeModel.move', () => {
  it('reorder-before within same parent: moves source to target index', () => {
    const { tree: t, result } = treeModel.move(fixture, 'a2', {
      kind: 'reorder-before',
      targetId: 'a1',
    });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a2', 'a1',
    ]);
    expect(result).toEqual({ parentId: 'a', index: 0 });
  });
  it('reorder-after within same parent', () => {
    const { tree: t, result } = treeModel.move(fixture, 'a1', {
      kind: 'reorder-after',
      targetId: 'a2',
    });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a2', 'a1',
    ]);
    expect(result).toEqual({ parentId: 'a', index: 1 });
  });
  it('make-child appends at end of target children', () => {
    const { tree: t, result } = treeModel.move(fixture, 'b', {
      kind: 'make-child',
      targetId: 'a',
    });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'a1', 'a2', 'b',
    ]);
    expect(result).toEqual({ parentId: 'a', index: 2 });
  });
  it('make-child initializes children when target had none', () => {
    const { tree: t, result } = treeModel.move(fixture, 'a2', {
      kind: 'make-child',
      targetId: 'b',
    });
    expect(treeModel.find(t, 'b')?.children?.map((n) => n.id)).toEqual(['a2']);
    expect(result).toEqual({ parentId: 'b', index: 0 });
  });
  it('reorder-before across parents', () => {
    const { tree: t, result } = treeModel.move(fixture, 'b', {
      kind: 'reorder-before',
      targetId: 'a1',
    });
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual([
      'b', 'a1', 'a2',
    ]);
    expect(result).toEqual({ parentId: 'a', index: 0 });
  });
  it('reorder-after to root', () => {
    const { tree: t, result } = treeModel.move(fixture, 'a1', {
      kind: 'reorder-after',
      targetId: 'a',
    });
    expect(t.map((n) => n.id)).toEqual(['a', 'a1', 'b']);
    expect(treeModel.find(t, 'a')?.children?.map((n) => n.id)).toEqual(['a2']);
    expect(result).toEqual({ parentId: null, index: 1 });
  });
  it('no-op when sourceId === targetId', () => {
    const out = treeModel.move(fixture, 'a', {
      kind: 'make-child',
      targetId: 'a',
    });
    expect(out.tree).toBe(fixture);
  });
  it('no-op when target is descendant of source', () => {
    const out = treeModel.move(fixture, 'a', {
      kind: 'make-child',
      targetId: 'a1a',
    });
    expect(out.tree).toBe(fixture);
  });
  it('no-op when source is unknown', () => {
    const out = treeModel.move(fixture, 'ghost', {
      kind: 'reorder-before',
      targetId: 'a',
    });
    expect(out.tree).toBe(fixture);
  });
  it('no-op when target is unknown', () => {
    const out = treeModel.move(fixture, 'a1', {
      kind: 'reorder-before',
      targetId: 'ghost',
    });
    expect(out.tree).toBe(fixture);
  });
});
