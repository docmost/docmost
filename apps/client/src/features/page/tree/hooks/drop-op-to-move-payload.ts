import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import type { SpaceTreeNode } from '@/features/page/tree/types';
import type { IMovePage } from '@/features/page/types/page.types';
import type { DropOp } from '@/features/page/tree/model/tree-model.types';
import { treeModel } from '@/features/page/tree/model/tree-model';

export function dropOpToMovePayload(
  tree: SpaceTreeNode[],
  sourceId: string,
  op: DropOp,
): IMovePage {
  // Compute the post-move tree so we read source's REAL neighbors at its new
  // position. Reading from the before-tree would mean treating source itself
  // as a neighbor of the target — wrong when source is adjacent to target.
  const { tree: after } = treeModel.move(tree, sourceId, op);
  const info = treeModel.siblingsOf(after, sourceId);
  if (!info) {
    return {
      pageId: sourceId,
      parentPageId: null,
      position: generateJitteredKeyBetween(null, null),
    };
  }

  const prev = info.siblings[info.index - 1] as SpaceTreeNode | undefined;
  const next = info.siblings[info.index + 1] as SpaceTreeNode | undefined;

  return {
    pageId: sourceId,
    parentPageId: info.parentId,
    position: generateJitteredKeyBetween(
      prev?.position ?? null,
      next?.position ?? null,
    ),
  };
}
