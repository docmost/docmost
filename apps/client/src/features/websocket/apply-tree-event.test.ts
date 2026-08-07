import { describe, it, expect } from 'vitest';
import { applyTreeEvent } from './apply-tree-event';
import type { SpaceTreeNode } from '@/features/page/tree/types';
import { treeModel } from '@/features/page/tree/model/tree-model';

const n = (
  id: string,
  overrides: Partial<SpaceTreeNode> = {},
): SpaceTreeNode =>
  ({
    id,
    name: id,
    spaceId: 'space-1',
    parentPageId: null,
    hasChildren: false,
    children: [],
    ...overrides,
  }) as unknown as SpaceTreeNode;

const fixture = (): SpaceTreeNode[] => [
  n('a', {
    hasChildren: true,
    children: [n('a1', { parentPageId: 'a' })],
  }),
  n('b'),
];

describe('applyTreeEvent — updateOne', () => {
  it('updates title/icon/isBase on the matching node', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'updateOne',
      spaceId: 'space-1',
      entity: ['pages'],
      id: 'a1',
      payload: { title: 'Renamed', icon: '🎯', isBase: true },
    });
    const node = treeModel.find(t, 'a1') as SpaceTreeNode;
    expect(node.name).toBe('Renamed');
    expect(node.icon).toBe('🎯');
    expect(node.isBase).toBe(true);
  });

  it('is a no-op for entities other than pages', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'updateOne',
      spaceId: 'space-1',
      entity: ['spaces'],
      id: 'a1',
      payload: { title: 'Renamed' },
    });
    expect(t).toBe(before);
  });

  it('is a no-op when the node is not loaded in this tree', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'updateOne',
      spaceId: 'space-1',
      entity: ['pages'],
      id: 'ghost',
      payload: { title: 'Renamed' },
    });
    expect(t).toBe(before);
  });
});

describe('applyTreeEvent — addTreeNode', () => {
  it('inserts under the given parent and flips its hasChildren', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'addTreeNode',
      spaceId: 'space-1',
      payload: { parentId: 'b', index: 0, data: n('b1', { parentPageId: 'b' }) },
    });
    expect(treeModel.find(t, 'b')?.children?.map((x) => x.id)).toEqual(['b1']);
    expect(treeModel.find(t, 'b')?.hasChildren).toBe(true);
  });

  it('is a no-op for a root insert when preserveRoots is set', () => {
    const before = fixture();
    const t = applyTreeEvent(
      before,
      {
        operation: 'addTreeNode',
        spaceId: 'space-1',
        payload: { parentId: null, index: 0, data: n('c') },
      },
      { preserveRoots: true },
    );
    expect(t).toBe(before);
  });

  it('allows a root insert when preserveRoots is not set', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'addTreeNode',
      spaceId: 'space-1',
      payload: { parentId: null, index: 0, data: n('c') },
    });
    expect(t.map((x) => x.id)).toContain('c');
  });

  it('is a no-op when the node already exists in this tree', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'addTreeNode',
      spaceId: 'space-1',
      payload: { parentId: 'a', index: 0, data: n('a1') },
    });
    expect(t).toBe(before);
  });
});

describe('applyTreeEvent — moveTreeNode', () => {
  it('relocates the node and updates hasChildren on old/new parents', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'moveTreeNode',
      spaceId: 'space-1',
      payload: {
        id: 'a1',
        parentId: 'b',
        oldParentId: 'a',
        index: 0,
        position: 'p1',
        pageData: {},
      },
    });
    expect(treeModel.find(t, 'a')?.children).toEqual([]);
    expect(treeModel.find(t, 'a')?.hasChildren).toBe(false);
    expect(treeModel.find(t, 'b')?.children?.map((x) => x.id)).toEqual(['a1']);
    expect(treeModel.find(t, 'b')?.hasChildren).toBe(true);
    expect(treeModel.find(t, 'a1')?.parentPageId).toBe('b');
    expect(treeModel.find(t, 'a1')?.position).toBe('p1');
  });

  it('removes the node when the destination parent is not loaded in this tree', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'moveTreeNode',
      spaceId: 'space-1',
      payload: {
        id: 'a1',
        parentId: 'ghost-parent',
        oldParentId: 'a',
        index: 0,
        position: 'p1',
        pageData: {},
      },
    });
    expect(treeModel.find(t, 'a1')).toBeNull();
  });

  it('is a no-op when the source is not loaded in this tree', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'moveTreeNode',
      spaceId: 'space-1',
      payload: {
        id: 'ghost',
        parentId: 'b',
        oldParentId: 'a',
        index: 0,
        position: 'p1',
        pageData: {},
      },
    });
    expect(t).toBe(before);
  });

  describe('preserveRoots', () => {
    it('is a no-op when the move would make the node a real top-level page', () => {
      const before = fixture();
      const t = applyTreeEvent(
        before,
        {
          operation: 'moveTreeNode',
          spaceId: 'space-1',
          payload: {
            id: 'a1',
            parentId: null,
            oldParentId: 'a',
            index: 0,
            position: 'p1',
            pageData: {},
          },
        },
        { preserveRoots: true },
      );
      expect(t).toBe(before);
    });

    it("does not restructure a root shortcut's own position", () => {
      // 'a' is itself a root-level entry (a favorite shortcut) — moving the
      // real page elsewhere must not reorder/evict its shortcut.
      const before = fixture();
      const t = applyTreeEvent(
        before,
        {
          operation: 'moveTreeNode',
          spaceId: 'space-1',
          payload: {
            id: 'a',
            parentId: 'b',
            oldParentId: null,
            index: 0,
            position: 'p1',
            pageData: {},
          },
        },
        { preserveRoots: true },
      );
      expect(t).toBe(before);
    });

    it('still relocates a real (non-root) descendant between subtrees', () => {
      const t = applyTreeEvent(
        fixture(),
        {
          operation: 'moveTreeNode',
          spaceId: 'space-1',
          payload: {
            id: 'a1',
            parentId: 'b',
            oldParentId: 'a',
            index: 0,
            position: 'p1',
            pageData: {},
          },
        },
        { preserveRoots: true },
      );
      expect(treeModel.find(t, 'b')?.children?.map((x) => x.id)).toEqual([
        'a1',
      ]);
    });
  });
});

describe('applyTreeEvent — deleteTreeNode', () => {
  it('removes the node and updates the old parent hasChildren', () => {
    const t = applyTreeEvent(fixture(), {
      operation: 'deleteTreeNode',
      spaceId: 'space-1',
      payload: { node: n('a1', { parentPageId: 'a' }) },
    });
    expect(treeModel.find(t, 'a1')).toBeNull();
    expect(treeModel.find(t, 'a')?.hasChildren).toBe(false);
  });

  it('is a no-op when the node is not loaded in this tree', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'deleteTreeNode',
      spaceId: 'space-1',
      payload: { node: n('ghost') },
    });
    expect(t).toBe(before);
  });
});

describe('applyTreeEvent — unhandled operations', () => {
  it('returns the same reference for an event it does not handle', () => {
    const before = fixture();
    const t = applyTreeEvent(before, {
      operation: 'invalidate',
      spaceId: 'space-1',
      entity: ['pages'],
    });
    expect(t).toBe(before);
  });
});
