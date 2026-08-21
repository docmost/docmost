import { describe, expect, it } from 'vitest';
import { treeModel } from '../model/tree-model';
import type { SpaceTreeNode } from '../types';
import { removePageFromTree } from './utils';

function node(
  id: string,
  overrides: Partial<SpaceTreeNode> = {},
): SpaceTreeNode {
  return {
    id,
    slugId: id,
    name: id,
    position: id,
    spaceId: 'space-a',
    parentPageId: null,
    hasChildren: false,
    children: [],
    ...overrides,
  };
}

describe('removePageFromTree', () => {
  it('removes a moved page subtree and clears the old parent child flag', () => {
    const tree: SpaceTreeNode[] = [
      node('parent', {
        hasChildren: true,
        children: [
          node('child', {
            parentPageId: 'parent',
            hasChildren: true,
            children: [node('grandchild', { parentPageId: 'child' })],
          }),
        ],
      }),
      node('unrelated-root', { spaceId: 'space-b' }),
    ];

    const next = removePageFromTree(tree, 'child');

    expect(treeModel.find(next, 'child')).toBeNull();
    expect(treeModel.find(next, 'grandchild')).toBeNull();
    expect(treeModel.find(next, 'parent')).toMatchObject({
      hasChildren: false,
      children: [],
    });
    expect(treeModel.find(next, 'unrelated-root')).toBe(tree[1]);
  });

  it('keeps the old parent marked as having children when siblings remain', () => {
    const tree: SpaceTreeNode[] = [
      node('parent', {
        hasChildren: true,
        children: [
          node('child', { parentPageId: 'parent' }),
          node('sibling', { parentPageId: 'parent' }),
        ],
      }),
    ];

    const next = removePageFromTree(tree, 'child');

    expect(treeModel.find(next, 'child')).toBeNull();
    expect(treeModel.find(next, 'parent')).toMatchObject({
      hasChildren: true,
      children: [expect.objectContaining({ id: 'sibling' })],
    });
  });

  it('removes duplicate stale copies across loaded spaces', () => {
    const tree: SpaceTreeNode[] = [
      node('source-parent', {
        hasChildren: true,
        children: [node('moved-page', { parentPageId: 'source-parent' })],
      }),
      node('other-space-parent', {
        spaceId: 'space-b',
        hasChildren: true,
        children: [
          node('moved-page', {
            spaceId: 'space-b',
            parentPageId: 'other-space-parent',
          }),
        ],
      }),
    ];

    const next = removePageFromTree(tree, 'moved-page');

    expect(treeModel.find(next, 'moved-page')).toBeNull();
    expect(treeModel.find(next, 'source-parent')).toMatchObject({
      hasChildren: false,
      children: [],
    });
    expect(treeModel.find(next, 'other-space-parent')).toMatchObject({
      hasChildren: false,
      children: [],
    });
  });

  it('returns the same tree reference when the page is not loaded', () => {
    const tree: SpaceTreeNode[] = [node('parent')];

    expect(removePageFromTree(tree, 'missing')).toBe(tree);
  });
});
