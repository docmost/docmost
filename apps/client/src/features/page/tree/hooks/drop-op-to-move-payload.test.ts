import { describe, it, expect, vi } from 'vitest';
import type { SpaceTreeNode } from '@/features/page/tree/types';
import { dropOpToMovePayload } from './drop-op-to-move-payload';

vi.mock('fractional-indexing-jittered', () => ({
  generateJitteredKeyBetween: (a: string | null, b: string | null) =>
    `${a ?? 'START'}|${b ?? 'END'}`,
}));

const n = (id: string, position: string, children?: SpaceTreeNode[]): SpaceTreeNode =>
  ({ id, position, children, name: id } as unknown as SpaceTreeNode);

const tree: SpaceTreeNode[] = [
  n('a', 'A', [n('a1', 'AA'), n('a2', 'AB')]),
  n('b', 'B'),
];

describe('dropOpToMovePayload', () => {
  it('reorder-before computes parentId + position between prev and target', () => {
    const p = dropOpToMovePayload(tree, 'a2', {
      kind: 'reorder-before',
      targetId: 'a1',
    });
    expect(p).toEqual({ pageId: 'a2', parentPageId: 'a', position: 'START|AA' });
  });

  it('reorder-after computes position between target and next', () => {
    const p = dropOpToMovePayload(tree, 'a1', {
      kind: 'reorder-after',
      targetId: 'a2',
    });
    expect(p).toEqual({ pageId: 'a1', parentPageId: 'a', position: 'AB|END' });
  });

  it('make-child appends with position after last child', () => {
    const p = dropOpToMovePayload(tree, 'b', {
      kind: 'make-child',
      targetId: 'a',
    });
    expect(p).toEqual({ pageId: 'b', parentPageId: 'a', position: 'AB|END' });
  });

  it('reorder-before at root: parentPageId is null', () => {
    const p = dropOpToMovePayload(tree, 'b', {
      kind: 'reorder-before',
      targetId: 'a',
    });
    expect(p).toEqual({ pageId: 'b', parentPageId: null, position: 'START|A' });
  });

  // Regression: when source is already adjacent to target, the BEFORE-tree
  // treats source itself as the target's neighbor and falls back to null,
  // producing an unbounded fractional key that overshoots other siblings.
  // The fix uses the AFTER-tree, where source occupies its destination slot
  // surrounded by its REAL neighbors.
  it('reorder-after when source is immediately after target uses post-move neighbors', () => {
    const adjacent: SpaceTreeNode[] = [
      n('a', 'A'),
      n('b', 'AB'),
      n('c', 'B'),
      n('d', 'BC'),
    ];
    const p = dropOpToMovePayload(adjacent, 'b', {
      kind: 'reorder-after',
      targetId: 'a',
    });
    // After-tree is [a, b, c, d] (no-op shape). Source 'b' at index 1.
    // prev = 'A', next = 'B'. Old buggy code returned prev='A', next=null.
    expect(p).toEqual({ pageId: 'b', parentPageId: null, position: 'A|B' });
  });

  it('reorder-before when source is immediately before target uses post-move neighbors', () => {
    const adjacent: SpaceTreeNode[] = [
      n('a', 'A'),
      n('b', 'AB'),
      n('c', 'B'),
      n('d', 'BC'),
    ];
    const p = dropOpToMovePayload(adjacent, 'b', {
      kind: 'reorder-before',
      targetId: 'c',
    });
    // After-tree is [a, b, c, d]. Source 'b' at index 1.
    // prev = 'A', next = 'B'. Old buggy code returned prev=null, next='B'.
    expect(p).toEqual({ pageId: 'b', parentPageId: null, position: 'A|B' });
  });

  it('make-child when source is already last child of target uses post-move neighbors', () => {
    const t: SpaceTreeNode[] = [
      n('p', 'P', [n('x', 'X'), n('y', 'Y')]),
    ];
    const p = dropOpToMovePayload(t, 'y', {
      kind: 'make-child',
      targetId: 'p',
    });
    // After-tree: 'y' becomes last child of 'p' → [x, y]. y at index 1.
    // prev = 'X', next = null. Old buggy: prev=Y (source's own position), next=null.
    expect(p).toEqual({ pageId: 'y', parentPageId: 'p', position: 'X|END' });
  });
});
