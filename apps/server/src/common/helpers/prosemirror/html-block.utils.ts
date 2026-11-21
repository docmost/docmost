import { validate as isValidUUID } from 'uuid';

const HTML_BLOCK_TYPE = 'htmlBlock';

export function getHtmlBlockIds(json: unknown): string[] {
  const ids = new Set<string>();

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === HTML_BLOCK_TYPE) {
      const id = node.attrs?.htmlBlockId;
      if (id && isValidUUID(id)) ids.add(id);
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };

  walk(json);
  return [...ids];
}

export function replaceHtmlBlockIds<T>(json: T, idMap: Map<string, string>): T {
  const walk = (node: any): any => {
    if (!node || typeof node !== 'object') return node;
    const copy = { ...node };
    if (node.type === HTML_BLOCK_TYPE && node.attrs) {
      const mapped = idMap.get(node.attrs.htmlBlockId);
      copy.attrs = mapped
        ? { ...node.attrs, htmlBlockId: mapped }
        : { ...node.attrs };
    }
    if (Array.isArray(node.content)) copy.content = node.content.map(walk);
    return copy;
  };

  return walk(json);
}

export function replaceHtmlBlocksWithCode<T>(
  json: T,
  contents: Map<string, string>,
): T {
  const walk = (node: any): any => {
    if (!node || typeof node !== 'object') return node;
    const copy = { ...node };
    if (Array.isArray(node.content)) {
      copy.content = node.content.flatMap((child: any) => {
        if (child?.type !== HTML_BLOCK_TYPE) return [walk(child)];
        const text = contents.get(child.attrs?.htmlBlockId);
        if (text === undefined) return [];
        const code: any = { type: 'codeBlock', attrs: { language: 'html' } };
        if (text) code.content = [{ type: 'text', text }];
        return [code];
      });
    }
    return copy;
  };

  const root: any = json;
  if (root?.type === HTML_BLOCK_TYPE) {
    const text = contents.get(root.attrs?.htmlBlockId);
    if (text === undefined) return root;
    const code: any = { type: 'codeBlock', attrs: { language: 'html' } };
    if (text) code.content = [{ type: 'text', text }];
    return code;
  }
  return walk(json);
}
