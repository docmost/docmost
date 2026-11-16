import { isDeepStrictEqual } from 'node:util';
import { getSchema, JSONContent } from '@tiptap/core';
import { Mark, Node, Schema } from '@tiptap/pm/model';
import { tiptapExtensions } from './collaboration.util';

type Comparable = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Comparable[];
  content?: Comparable[];
};

type BlockLike = { type?: string; content?: unknown[] };

const EMPTY_DOCUMENT = { type: 'doc', content: [] };

const REVIEW_ID_STRIPPED_TYPES = ['heading', 'paragraph', 'transclusionSource'];

let cachedSchema: Schema | null = null;

function getServerSchema(): Schema {
  cachedSchema ??= getSchema(tiptapExtensions);
  return cachedSchema;
}

function toComparableAttrs(
  attrs: Record<string, unknown>,
  specs: Record<string, { default?: unknown }>,
  ignored: string[],
): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (ignored.includes(name) || value === null || value === undefined) {
      continue;
    }
    if (isDeepStrictEqual(value, specs[name]?.default)) continue;
    result[name] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function toComparableMark(mark: Mark): Comparable {
  const attrs = toComparableAttrs(mark.attrs, mark.type.spec.attrs ?? {}, []);
  return { type: mark.type.name, ...(attrs && { attrs }) };
}

function isEmptyParagraph(node: BlockLike): boolean {
  return node.type === 'paragraph' && !node.content?.length;
}

function dropTrailingEmptyParagraphs<T extends BlockLike>(content: T[]): T[] {
  const result = [...content];
  const footnotes =
    result[result.length - 1]?.type === 'footnotes' ? result.pop() : undefined;
  while (result.length > 0 && isEmptyParagraph(result[result.length - 1])) {
    result.pop();
  }
  if (footnotes) result.push(footnotes);
  return result;
}

function toComparableChildren(node: Node): Comparable[] {
  const children: Comparable[] = [];
  node.forEach((child) => {
    if (!child.isText) {
      children.push(toComparable(child));
      return;
    }
    const marks = child.marks
      .filter((mark) => mark.type.name !== 'comment')
      .map(toComparableMark);
    const previous = children[children.length - 1];
    if (
      previous?.type === 'text' &&
      isDeepStrictEqual(previous.marks ?? [], marks)
    ) {
      previous.text += child.text;
      return;
    }
    children.push({
      type: 'text',
      text: child.text,
      ...(marks.length && { marks }),
    });
  });
  return node.type.name === 'doc'
    ? dropTrailingEmptyParagraphs(children)
    : children;
}

function toComparable(node: Node): Comparable {
  const ignored = node.type.name === 'details' ? ['id', 'open'] : ['id'];
  const attrs = toComparableAttrs(
    node.attrs,
    node.type.spec.attrs ?? {},
    ignored,
  );
  const content = toComparableChildren(node);
  return {
    type: node.type.name,
    ...(attrs && { attrs }),
    ...(content.length && { content }),
  };
}

function parseDocument(value: unknown): Comparable | null {
  if (!value || typeof value !== 'object') return null;
  try {
    return toComparable(Node.fromJSON(getServerSchema(), value));
  } catch {
    return null;
  }
}

export function isSameDocumentContent(
  previous: unknown,
  next: unknown,
): boolean {
  const previousComparable = parseDocument(previous ?? EMPTY_DOCUMENT);
  const nextComparable = parseDocument(next ?? EMPTY_DOCUMENT);
  if (!previousComparable || !nextComparable) {
    return isDeepStrictEqual(previous, next);
  }
  return isDeepStrictEqual(previousComparable, nextComparable);
}

function toReviewNode(node: JSONContent): JSONContent {
  const { attrs, marks, content, ...rest } = node;
  let nextAttrs = attrs;
  if (node.type === 'details') {
    nextAttrs = { ...attrs, open: true };
  } else if (attrs && REVIEW_ID_STRIPPED_TYPES.includes(node.type ?? '')) {
    const { id: _id, ...others } = attrs;
    nextAttrs = Object.keys(others).length ? others : undefined;
  }
  const nextMarks = marks?.filter((mark) => mark.type !== 'comment');
  const nextContent = content?.map(toReviewNode);
  return {
    ...rest,
    ...(nextAttrs && { attrs: nextAttrs }),
    ...(nextMarks?.length && { marks: nextMarks }),
    ...(nextContent && {
      content:
        node.type === 'doc'
          ? dropTrailingEmptyParagraphs(nextContent)
          : nextContent,
    }),
  };
}

// Display sibling of isSameDocumentContent: keeps ids the client needs to render.
export function toReviewDocument(content: unknown): JSONContent {
  const source =
    content && typeof content === 'object' ? content : EMPTY_DOCUMENT;
  return toReviewNode(source as JSONContent);
}
