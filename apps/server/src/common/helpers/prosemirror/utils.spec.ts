import { stripCommentMarks } from './utils';

const comment = (id: string) => ({
  type: 'comment',
  attrs: { commentId: id, resolved: false },
});

describe('stripCommentMarks', () => {
  it('removes comment marks at any depth and keeps the other marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold and commented',
              marks: [{ type: 'bold' }, comment('c1')],
            },
            { type: 'text', text: 'only commented', marks: [comment('c2')] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'nested', marks: [comment('c3')] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(stripCommentMarks(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bold and commented',
              marks: [{ type: 'bold' }],
            },
            { type: 'text', text: 'only commented' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'nested' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('keeps unknown mark and node types instead of throwing', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          attrs: { kind: 'x' },
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [{ type: 'futureMark', attrs: { a: 1 } }, comment('c1')],
            },
          ],
        },
      ],
    };

    expect(stripCommentMarks(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'futureBlock',
          attrs: { kind: 'x' },
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [{ type: 'futureMark', attrs: { a: 1 } }],
            },
          ],
        },
      ],
    });
  });

  it('does not mutate its input', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [comment('c1')] }],
        },
      ],
    };
    const before = JSON.stringify(doc);

    stripCommentMarks(doc);

    expect(JSON.stringify(doc)).toBe(before);
  });

  it('passes empty content through', () => {
    expect(stripCommentMarks(null)).toBeNull();
    expect(stripCommentMarks(undefined)).toBeUndefined();
  });
});
