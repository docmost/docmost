import { validate as isValidUUID } from 'uuid';
import { getSchema } from '@tiptap/core';
import { Schema } from '@tiptap/pm/model';
import { tiptapExtensions } from '../../../collaboration/collaboration.util';
import {
  HTML_BLOCK_EXPORT_LANGUAGE,
  HTML_BLOCK_IMPORT_MAX_PER_PAGE,
  HTML_BLOCK_MAX_BYTES,
} from './html-block.constants';

const HTML_BLOCK_TYPE = 'htmlBlock';

let importSchema: Schema | null = null;

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
  options?: { language?: string },
): T {
  const language = options?.language ?? 'html';
  const walk = (node: any): any => {
    if (!node || typeof node !== 'object') return node;
    const copy = { ...node };
    if (Array.isArray(node.content)) {
      copy.content = node.content.flatMap((child: any) => {
        if (child?.type !== HTML_BLOCK_TYPE) return [walk(child)];
        const text = contents.get(child.attrs?.htmlBlockId);
        if (text === undefined) return [];
        const code: any = { type: 'codeBlock', attrs: { language } };
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
    const code: any = { type: 'codeBlock', attrs: { language } };
    if (text) code.content = [{ type: 'text', text }];
    return code;
  }
  return walk(json);
}

function isImportedHtmlBlockCode(node: any): boolean {
  return (
    node?.type === 'codeBlock' &&
    node.attrs?.language === HTML_BLOCK_EXPORT_LANGUAGE
  );
}

function hasImportedHtmlBlocks(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (node.type === HTML_BLOCK_TYPE || isImportedHtmlBlockCode(node)) {
    return true;
  }
  return Array.isArray(node.content) && node.content.some(hasImportedHtmlBlocks);
}

export function convertImportedHtmlBlocks<T>(
  json: T,
  options: { allowed: boolean; generateId: () => string },
): { json: T; blocks: { id: string; content: string }[] } {
  if (!hasImportedHtmlBlocks(json)) return { json, blocks: [] };

  const schema = options.allowed
    ? (importSchema ??= getSchema(tiptapExtensions))
    : null;
  const htmlBlockType = schema?.nodes[HTML_BLOCK_TYPE];
  const codeBlockType = schema?.nodes.codeBlock;
  const blocks: { id: string; content: string }[] = [];
  const asHtmlCode = (code: any) => ({
    ...code,
    attrs: { ...code.attrs, language: 'html' },
  });

  const walk = (node: any): any => {
    if (!Array.isArray(node?.content)) return node;
    let match = schema?.nodes[node.type]?.contentMatch ?? null;
    const children: any[] = [];
    const converted: { index: number; id: string; code: any }[] = [];
    let changed = false;
    let dropped = false;

    for (const child of node.content) {
      // an imported htmlBlock points at a block the new page does not own
      if (child?.type === HTML_BLOCK_TYPE) {
        changed = dropped = true;
        continue;
      }

      if (isImportedHtmlBlockCode(child)) {
        changed = true;
        const next =
          blocks.length < HTML_BLOCK_IMPORT_MAX_PER_PAGE
            ? (match?.matchType(htmlBlockType) ?? null)
            : null;
        const content: string = next
          ? (child.content ?? []).map((text: any) => text?.text ?? '').join('')
          : '';
        // Postgres text columns cannot store NUL
        const storable =
          content !== '' &&
          !content.includes('\u0000') &&
          Buffer.byteLength(content, 'utf8') <= HTML_BLOCK_MAX_BYTES;
        if (next && storable) {
          const id = options.generateId();
          blocks.push({ id, content });
          converted.push({ index: children.length, id, code: child });
          children.push({
            type: HTML_BLOCK_TYPE,
            attrs: { htmlBlockId: id, height: null },
          });
          match = next;
        } else {
          children.push(asHtmlCode(child));
          match = match?.matchType(codeBlockType) ?? null;
        }
        continue;
      }

      const walked = walk(child);
      if (walked !== child) changed = true;
      children.push(walked);
      const childType = schema?.nodes[child?.type];
      match = childType ? (match?.matchType(childType) ?? null) : null;
    }

    if (!changed) return node;
    // a container needs a block after the drop, and a doc needs one before its footnotes
    if (dropped && !children.some((child) => child?.type !== 'footnotes')) {
      children.unshift({ type: 'paragraph' });
    }
    // if the rebuilt content does not fit the parent, all its candidates stay code
    if (converted.length > 0 && !match?.validEnd) {
      const reverted = new Set(converted.map(({ id }) => id));
      for (const { index, code } of converted) {
        children[index] = asHtmlCode(code);
      }
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (reverted.has(blocks[i].id)) blocks.splice(i, 1);
      }
    }
    return { ...node, content: children };
  };

  return { json: walk(json), blocks };
}

export function isHtmlBlocksEnabled(input: {
  settings: unknown;
  disabledOnServer: boolean;
}): boolean {
  const settings = input.settings as Record<string, any> | null;
  return !input.disabledOnServer && settings?.htmlBlocks?.enabled === true;
}

export function canAuthorHtmlBlocks(input: {
  settings: unknown;
  licensed: boolean;
  disabledOnServer: boolean;
}): boolean {
  return input.licensed && isHtmlBlocksEnabled(input);
}
