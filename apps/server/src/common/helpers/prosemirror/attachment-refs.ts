import { validate as isValidUUID } from 'uuid';
import { isAttachmentNode } from './attachment-node-types';

// `/files/<id>/…` or `/api/files/<id>/…`, optionally with scheme and host.
const ATTACHMENT_URL_REGEX =
  /^(?:https?:\/\/[^/]+)?(?:\/api)?\/files\/([0-9a-f-]{36})\//i;

export function getAttachmentIdFromUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const id = ATTACHMENT_URL_REGEX.exec(url)?.[1];
  return isValidUUID(id) ? id.toLowerCase() : undefined;
}

/**
 * The attachment a node points to, in lowercase: its `attachmentId`, or the
 * id in its `src`/`url` when only the file url is known (e.g. content from
 * markdown).
 */
function getReferencedAttachmentId(
  attrs: Record<string, any>,
): string | undefined {
  if (isValidUUID(attrs.attachmentId)) return attrs.attachmentId.toLowerCase();
  return getAttachmentIdFromUrl(attrs.src) ?? getAttachmentIdFromUrl(attrs.url);
}

function visitAttachmentNodes(
  node: any,
  fn: (attrs: Record<string, any>, nodeType: string) => void,
): void {
  if (!node || typeof node !== 'object') return;

  if (typeof node.type === 'string' && isAttachmentNode(node.type)) {
    if (node.attrs) fn(node.attrs, node.type);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) visitAttachmentNodes(child, fn);
  }
}

/**
 * Unique ids of the attachments referenced by attachment nodes (only nodes of
 * `nodeTypes` if given), including nodes without an `attachmentId` whose url
 * points to an attachment.
 */
export function getReferencedAttachmentIds(
  prosemirrorJson: unknown,
  nodeTypes?: string[],
): string[] {
  const ids = new Set<string>();
  visitAttachmentNodes(prosemirrorJson, (attrs, nodeType) => {
    if (nodeTypes && !nodeTypes.includes(nodeType)) return;
    const id = getReferencedAttachmentId(attrs);
    if (id) ids.add(id);
  });
  return Array.from(ids);
}

/**
 * Returns a copy of the content where every attachment node that references
 * an id in `idMap` points to the mapped id, in `attachmentId` and inside
 * `src`/`url`. Mapping an id to itself only fills in a missing
 * `attachmentId`. Ids are matched regardless of case, `idMap` keys are
 * lowercase. Does not mutate the input.
 */
export function replaceAttachmentIds<T>(
  prosemirrorJson: T,
  idMap: Map<string, string>,
): T {
  const cloned = JSON.parse(JSON.stringify(prosemirrorJson));

  visitAttachmentNodes(cloned, (attrs) => {
    const oldId = getReferencedAttachmentId(attrs);
    const newId = oldId && idMap.get(oldId);
    if (!newId) return;

    attrs.attachmentId = newId;
    for (const key of ['src', 'url']) {
      if (typeof attrs[key] === 'string') {
        // oldId is a validated uuid, so it is safe to use as a pattern.
        attrs[key] = attrs[key].replace(new RegExp(oldId, 'gi'), newId);
      }
    }
  });

  return cloned;
}
