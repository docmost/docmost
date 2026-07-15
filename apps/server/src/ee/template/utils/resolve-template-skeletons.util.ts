const TEMPLATE_SKELETON_NODE_TYPE = 'templateSkeleton';

interface ProseMirrorNode {
  type?: string;
  attrs?: Record<string, any>;
  content?: ProseMirrorNode[];
  [key: string]: any;
}

/**
 * Replaces templateSkeleton placeholder nodes (used only in the template
 * editor) with the real, empty node they stand in for, so pages created
 * from a template show the actual Draw.io/Excalidraw block.
 */
export function resolveTemplateSkeletons<T>(content: T): T {
  if (!content) {
    return content;
  }

  return walk(content as unknown as ProseMirrorNode) as unknown as T;
}

function walk(node: ProseMirrorNode): ProseMirrorNode {
  if (Array.isArray(node)) {
    return node.map(walk) as unknown as ProseMirrorNode;
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  if (node.type === TEMPLATE_SKELETON_NODE_TYPE) {
    return { type: node.attrs?.kind, attrs: {} };
  }

  const resolved: ProseMirrorNode = { ...node };
  if (Array.isArray(node.content)) {
    resolved.content = node.content.map(walk);
  }

  return resolved;
}
