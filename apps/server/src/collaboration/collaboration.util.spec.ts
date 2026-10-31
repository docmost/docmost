import { addUniqueIdsToDoc } from '@docmost/editor-ext';
import type { JSONContent } from '@tiptap/core';
import { generateJSON } from '../common/helpers/prosemirror/html';
import { tiptapExtensions } from './collaboration.util';

const ID_TYPES = ['heading', 'paragraph'];

function collectNodes(node: JSONContent, found: JSONContent[] = []) {
  found.push(node);
  node.content?.forEach((child) => collectNodes(child, found));
  return found;
}

const nodesOfType = (doc: JSONContent, types: string[]) =>
  collectNodes(doc).filter((node) => types.includes(node.type));

const withoutIds = (doc: JSONContent) =>
  JSON.parse(
    JSON.stringify(doc, (key, value) => (key === 'id' ? null : value)),
  );

describe('addUniqueIdsToDoc', () => {
  const html = [
    '<h2>Title</h2>',
    '<p>Text with <strong>bold</strong> and <a href="https://example.com">a link</a></p>',
    '<ul><li><p>Item</p><ul><li><p>Nested item</p></li></ul></li></ul>',
    '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
    '<blockquote><p>Quote</p></blockquote>',
    '<pre><code>const code = true;</code></pre>',
    '<hr>',
  ].join('');
  const doc = generateJSON(html, tiptapExtensions);

  it('gives every heading and paragraph an id, at any depth', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const nodes = nodesOfType(result, ID_TYPES);
    expect(nodes).toHaveLength(6);
    nodes.forEach((node) => expect(node.attrs.id).toEqual(expect.any(String)));
  });

  it('gives every node a different id', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const ids = nodesOfType(result, ID_TYPES).map((node) => node.attrs.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps an id that is already there', () => {
    const withId = JSON.parse(JSON.stringify(doc));
    nodesOfType(withId, ['heading'])[0].attrs.id = 'existing-id';

    const result = addUniqueIdsToDoc(withId, tiptapExtensions);

    expect(nodesOfType(result, ['heading'])[0].attrs.id).toBe('existing-id');
  });

  it('leaves everything else in the document as it was', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    expect(withoutIds(result)).toEqual(withoutIds(doc));
  });

  it('adds no id to other node types', () => {
    const result = addUniqueIdsToDoc(doc, tiptapExtensions);

    const others = collectNodes(result).filter(
      (node) => !ID_TYPES.includes(node.type),
    );
    expect(others.length).toBeGreaterThan(0);
    others.forEach((node) => expect(node.attrs?.id).toBeUndefined());
  });

  it('does not change the document it is given', () => {
    const input = generateJSON(html, tiptapExtensions);
    const before = JSON.stringify(input);

    addUniqueIdsToDoc(input, tiptapExtensions);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('throws when the UniqueID extension is missing', () => {
    const extensions = tiptapExtensions.filter(
      (extension) => extension.name !== 'uniqueID',
    );

    expect(() => addUniqueIdsToDoc(doc, extensions)).toThrow(
      'UniqueID extension not found',
    );
  });

  it('handles a very long document in well under a second', () => {
    const longDoc = {
      type: 'doc',
      content: Array.from({ length: 10000 }, () => ({
        type: 'paragraph',
        content: [{ type: 'text', text: 'a' }],
      })),
    };

    const started = performance.now();
    const result = addUniqueIdsToDoc(longDoc, tiptapExtensions);
    const elapsed = performance.now() - started;

    expect(nodesOfType(result, ['paragraph'])).toHaveLength(10000);
    expect(elapsed).toBeLessThan(1000);
  });
});
