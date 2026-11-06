import { createHash } from 'crypto';
import type { Node } from '@tiptap/pm/model';

export const BLOCK_REF_CONTAINERS: ReadonlySet<string> = new Set([
  'doc',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'blockquote',
  'callout',
  'columns',
  'column',
  'detailsContent',
  'tabs',
  'tabPanel',
  'transclusionSource',
]);

export type BlockRefEntry = { ref: string; node: Node; path: number[] };

export type BlockRefIndex = {
  byRef: Map<string, BlockRefEntry>;
  byNode: Map<Node, string>;
};

const REF_LENGTH = 6;
const REF_SPACE = 36n ** BigInt(REF_LENGTH);

function hashNode(node: Node): string {
  const hex = createHash('sha1')
    .update(JSON.stringify(node.toJSON()))
    .digest('hex');
  const value = BigInt('0x' + hex.slice(0, 16)) % REF_SPACE;
  return value.toString(36).padStart(REF_LENGTH, '0');
}

export function computeBlockRefs(doc: Node): BlockRefIndex {
  const byRef = new Map<string, BlockRefEntry>();
  const byNode = new Map<Node, string>();
  const seen = new Map<string, number>();

  const walk = (parent: Node, parentPath: number[]) => {
    if (!BLOCK_REF_CONTAINERS.has(parent.type.name)) return;

    parent.forEach((child, _offset, index) => {
      const path = [...parentPath, index];
      const hash = hashNode(child);
      const count = (seen.get(hash) ?? 0) + 1;
      seen.set(hash, count);

      const ref = count === 1 ? hash : `${hash}-${count}`;
      byRef.set(ref, { ref, node: child, path });
      byNode.set(child, ref);

      walk(child, path);
    });
  };

  walk(doc, []);
  return { byRef, byNode };
}
