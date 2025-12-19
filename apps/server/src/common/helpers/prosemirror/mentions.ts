export interface MentionNode {
  id: string;
  label: string;
  entityType: 'user' | 'page';
  entityId: string;
  creatorId: string;
}

export function extractMentions(prosemirrorJson: any) {
  const mentionList: MentionNode[] = [];
  const seen = new Set<string>();

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    if (node.type === 'mention') {
      const attrs = node.attrs || {};
      const id = attrs.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        mentionList.push({
          id,
          label: attrs.label,
          entityType: attrs.entityType,
          entityId: attrs.entityId,
          creatorId: attrs.creatorId,
        });
      }
    }

    if (node.content) walk(node.content);
  };

  walk(prosemirrorJson);
  return mentionList;
}

export function extractUserMentions(mentionList: MentionNode[]): MentionNode[] {
  return mentionList.filter((m) => m.entityType === 'user');
}

export function extractPageMentions(mentionList: MentionNode[]): MentionNode[] {
  const deduped: MentionNode[] = [];
  for (const mention of mentionList) {
    if (
      mention.entityType === 'page' &&
      !deduped.some((m) => m.entityId === mention.entityId)
    ) {
      deduped.push(mention);
    }
  }
  return deduped;
}

export function prosemirrorToTextWithMentions(prosemirrorJson: any): string {
  const parts: string[] = [];

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    switch (node.type) {
      case 'text':
        if (typeof node.text === 'string') parts.push(node.text);
        return;
      case 'hardBreak':
        parts.push('\n');
        return;
      case 'mention': {
        const label = node?.attrs?.label || node?.attrs?.id || 'user';
        parts.push(`@${label}`);
        return;
      }
      case 'paragraph':
      case 'heading':
      case 'blockquote':
      case 'listItem':
      case 'taskItem':
      case 'tableRow':
      case 'tableCell':
      case 'tableHeader':
        walk(node.content);
        parts.push('\n');
        return;
      default:
        walk(node.content);
        return;
    }
  };

  walk(prosemirrorJson);
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeWhitespace(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function excerptAroundIndex(text: string, idx: number, maxLen: number): string {
  const raw = (text || '').trim();
  if (!raw) return '';

  const safe = normalizeWhitespace(raw);
  if (!Number.isFinite(idx) || idx < 0) return safe.slice(0, maxLen);

  // Compute window using the raw string indices (so indices we recorded during traversal remain valid),
  // then normalize whitespace inside the window for email rendering.
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(raw.length, idx + half);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < raw.length ? '…' : '';
  const window = normalizeWhitespace(raw.slice(start, end));
  return `${prefix}${window}${suffix}`;
}

type BlockExtract = {
  rawText: string;
  mentionIds: Set<string>;
  mentionIndexById: Map<string, number>;
};

function extractBlocksWithMentions(prosemirrorJson: any): BlockExtract[] {
  const blocks: BlockExtract[] = [];

  const isBlock = (type: string) =>
    [
      'paragraph',
      'heading',
      'blockquote',
      'listItem',
      'taskItem',
      'tableCell',
      'tableHeader',
    ].includes(type);

  const walkInline = (
    node: any,
    out: { parts: string[]; mentionIds: Set<string>; mentionIndexById: Map<string, number> },
  ) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walkInline(child, out);
      return;
    }

    switch (node.type) {
      case 'text':
        if (typeof node.text === 'string') out.parts.push(node.text);
        return;
      case 'hardBreak':
        out.parts.push('\n');
        return;
      case 'mention': {
        const attrs = node.attrs || {};
        const id = attrs.id;
        const label = attrs.label || id || 'user';
        const token = `@${label}`;
        if (id) {
          out.mentionIds.add(id);
          // record the first time we see this mention id in the block
          if (!out.mentionIndexById.has(id)) {
            const currentLen = out.parts.join('').length;
            out.mentionIndexById.set(id, currentLen);
          }
        }
        out.parts.push(token);
        return;
      }
      default:
        walkInline(node.content, out);
        return;
    }
  };

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    if (node.type && isBlock(node.type)) {
      const out = {
        parts: [] as string[],
        mentionIds: new Set<string>(),
        mentionIndexById: new Map<string, number>(),
      };
      walkInline(node.content, out);

      const rawText = out.parts.join('').trim();
      if (rawText) {
        blocks.push({
          rawText,
          mentionIds: out.mentionIds,
          mentionIndexById: out.mentionIndexById,
        });
      }
      return;
    }

    if (node.content) walk(node.content);
  };

  walk(prosemirrorJson);
  return blocks;
}

export function snippetForMentionId(
  prosemirrorJson: any,
  mentionId: string,
  opts?: { minLen?: number; maxLen?: number },
): string {
  const minLen = opts?.minLen ?? 120;
  const maxLen = opts?.maxLen ?? 300;

  if (!prosemirrorJson || !mentionId) {
    return excerptAroundIndex(prosemirrorToTextWithMentions(prosemirrorJson), 0, maxLen);
  }

  const blocks = extractBlocksWithMentions(prosemirrorJson);
  if (!blocks.length) {
    return excerptAroundIndex(prosemirrorToTextWithMentions(prosemirrorJson), 0, maxLen);
  }

  const idx = blocks.findIndex((b) => b.mentionIds.has(mentionId));
  if (idx < 0) {
    return excerptAroundIndex(prosemirrorToTextWithMentions(prosemirrorJson), 0, maxLen);
  }

  // Start with the containing block (usually the "relevant paragraph")
  let combinedRaw = blocks[idx].rawText;
  let mentionIndex = blocks[idx].mentionIndexById.get(mentionId) ?? -1;

  // If too short, add neighboring blocks for context, but keep it bounded.
  if (normalizeWhitespace(combinedRaw).length < minLen) {
    let left = idx - 1;
    let right = idx + 1;
    while (
      normalizeWhitespace(combinedRaw).length < minLen &&
      (left >= 0 || right < blocks.length)
    ) {
      const separator = ' … ';
      if (left >= 0) {
        const prefix = blocks[left].rawText;
        combinedRaw = `${prefix}${separator}${combinedRaw}`;
        mentionIndex += prefix.length + separator.length;
        left -= 1;
      }
      if (normalizeWhitespace(combinedRaw).length >= minLen) break;
      if (right < blocks.length) {
        combinedRaw = `${combinedRaw}${separator}${blocks[right].rawText}`;
        right += 1;
      }
      if (combinedRaw.length > maxLen * 4) break; // hard stop to avoid runaway on pathological docs
    }
  }

  const combinedSafe = normalizeWhitespace(combinedRaw);
  if (combinedSafe.length <= maxLen) return combinedSafe;
  return excerptAroundIndex(combinedRaw, mentionIndex, maxLen);
}


