import type { JSONContent } from '@tiptap/core';
import { jsonToText } from '../../src/collaboration/collaboration.util';

// PostgreSQL's english parser drops `<tag>` (no space after `<`) and keeps
// the words around it. Search can match a tag name only when it is not inside
// one of those tags. `jsonToText` is what gets stored and indexed.
const POSTGRES_XML_TAG = /<[^>\s][^>]*>/g;

function pageText(content: JSONContent[]): string {
  return jsonToText({ type: 'doc', content });
}

function codeBlock(text: string): JSONContent {
  return {
    type: 'codeBlock',
    content: [{ type: 'text', text }],
  };
}

function expectTermSearchable(text: string, term: string) {
  expect(text).toContain(term);
  const tags = text.match(POSTGRES_XML_TAG) ?? [];
  expect(tags.join(' ')).not.toContain(term);
}

describe('Code Block Search', () => {
  const sample = '<ACT>\n  <P_NUM>TEST</P_NUM>\n</ACT>';

  it('should find XML tag name P_NUM in code block', () => {
    const text = pageText([codeBlock(sample)]);
    expectTermSearchable(text, 'P_NUM');
    expect(text).toMatch(/< P_NUM[\s\S]*TEST/);
  });

  it('should find XML tag content TEST in code block', () => {
    expectTermSearchable(pageText([codeBlock(sample)]), 'TEST');
  });

  it('should find all tag names and content in multi-tag code block', () => {
    const text = pageText([
      codeBlock('<OUTER><INNER>VALUE</INNER></OUTER>'),
    ]);

    expectTermSearchable(text, 'OUTER');
    expectTermSearchable(text, 'INNER');
    expectTermSearchable(text, 'VALUE');
  });

  it('should find tag names in multiple code blocks on same page', () => {
    const text = pageText([
      codeBlock('<FIRST>A</FIRST>'),
      codeBlock('<SECOND>B</SECOND>'),
    ]);

    expectTermSearchable(text, 'FIRST');
    expectTermSearchable(text, 'SECOND');
  });

  it('should find code block content alongside normal text', () => {
    const text = pageText([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Normal paragraph text' }],
      },
      codeBlock('<TAG>CodeContent</TAG>'),
    ]);

    expectTermSearchable(text, 'paragraph');
    expectTermSearchable(text, 'TAG');
    expectTermSearchable(text, 'CodeContent');
    expect(text.startsWith('Normal paragraph text')).toBe(true);
  });

  it('keeps code block characters, including brackets, in document order', () => {
    const text = pageText([codeBlock(sample)]);

    expect(text.replace(/< /g, '<')).toBe(sample);
  });

  it('does not rewrite XML-like text outside code blocks', () => {
    const text = pageText([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'See <P_NUM>TEST</P_NUM> here' }],
      },
    ]);

    expect(text).toBe('See <P_NUM>TEST</P_NUM> here');
  });
});
