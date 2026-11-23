import { createHash } from 'crypto';
import { getSchema, type JSONContent } from '@tiptap/core';
import type { MarkType, Node, NodeType, Schema } from '@tiptap/pm/model';
import { tiptapExtensions } from '../collaboration.util';

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
  'details',
  'detailsContent',
  'tabs',
  'tab',
  'tabPanel',
  'transclusionSource',
]);

export type BlockRefEntry = { ref: string; node: Node; path: number[] };

export type BlockRefIndex = {
  byRef: Map<string, BlockRefEntry>;
  byNode: Map<Node, string>;
};

let pageSchema: Schema;
const revisions = new WeakMap<Node, string>();

function checkAttributes(
  type: NodeType | MarkType,
  attrs: unknown,
  legacyMark = false,
) {
  if (attrs == null || (legacyMark && attrs === true)) return;
  if (typeof attrs !== 'object' || Array.isArray(attrs)) {
    throw new RangeError(`Invalid attributes on ${type.name}.`);
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (
      value != null &&
      !Object.prototype.hasOwnProperty.call(type.spec.attrs ?? {}, name)
    ) {
      throw new RangeError(`Unsupported attribute "${name}" on ${type.name}.`);
    }
  }
}

// Node.fromJSON fills defaults and silently drops unrecognized attributes.
function checkedJson(node: JSONContent, schema: Schema): JSONContent {
  const type = schema.nodes[node.type];
  if (!type) throw new RangeError(`Unsupported node type "${node.type}".`);
  if (
    type.isText &&
    typeof node.text === 'string' &&
    /\p{Surrogate}/u.test(node.text)
  )
    throw new RangeError('Text contains an incomplete Unicode character.');
  checkAttributes(type, node.attrs);
  if (
    (node.marks != null && !Array.isArray(node.marks)) ||
    (node.content != null && !Array.isArray(node.content)) ||
    (!type.isText && node.text != null)
  ) {
    throw new RangeError(`Invalid structure for ${type.name}.`);
  }
  if (!type.isText && node.marks?.length) {
    throw new RangeError(
      `Formatting on ${type.name} cannot be preserved in collaboration.`,
    );
  }
  for (const mark of node.marks ?? []) {
    const type = schema.marks[mark.type];
    if (!type) throw new RangeError(`Unsupported mark type "${mark.type}".`);
    checkAttributes(type, mark.attrs, true);
  }
  if (type.isText && node.content?.length) {
    throw new RangeError('Text cannot contain child nodes.');
  }
  // Yjs omits null element attributes, so schema defaults also apply on a stored-page read.
  let attrs = node.attrs;
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null && type.spec.attrs?.[key]?.default != null) {
      if (attrs === node.attrs) attrs = { ...attrs };
      delete attrs[key];
    }
  }
  let content = node.content;
  node.content?.forEach((child, i) => {
    const checked = checkedJson(child, schema);
    if (checked !== child) {
      if (content === node.content) content = [...content];
      content[i] = checked;
    }
  });
  return attrs === node.attrs && content === node.content
    ? node
    : { ...node, attrs, content };
}

export function editableNode(json: JSONContent, schema: Schema): Node {
  const node = schema.nodeFromJSON(checkedJson(json, schema));
  // A new page has an empty Y.XmlFragment until its first edit.
  if (node.type !== schema.topNodeType || node.childCount > 0) node.check();
  return node;
}

export function editableDocument(json: JSONContent): Node {
  const schema = (pageSchema ??= getSchema(tiptapExtensions));
  if (json?.type !== schema.topNodeType.name) {
    throw new RangeError('Expected a page document.');
  }
  return editableNode(json, schema);
}

export function pageRevision(doc: Node): string {
  const previous = revisions.get(doc);
  if (previous) return previous;
  const canonical = JSON.stringify(doc.toJSON(), (_key, value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, value[k]]),
    );
  });
  const revision = `v1-${createHash('sha256').update(canonical).digest('base64url')}`;
  revisions.set(doc, revision);
  return revision;
}

export function computeBlockRefs(doc: Node): BlockRefIndex {
  const byRef = new Map<string, BlockRefEntry>();
  const byNode = new Map<Node, string>();

  const walk = (parent: Node, parentPath: number[]) => {
    if (!BLOCK_REF_CONTAINERS.has(parent.type.name)) return;

    parent.forEach((child, _offset, index) => {
      const path = [...parentPath, index];
      const ref = `b${(byRef.size + 1).toString(36)}`;
      byRef.set(ref, { ref, node: child, path });
      byNode.set(child, ref);

      walk(child, path);
    });
  };

  walk(doc, []);
  return { byRef, byNode };
}
