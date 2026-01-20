import { prosemirrorToTextWithMentions } from './mentions';

describe('prosemirrorToTextWithMentions', () => {
  it('renders mention nodes as @label and preserves basic structure', () => {
    const text = prosemirrorToTextWithMentions({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'mention',
              attrs: { id: 'm1', label: 'Alice', entityType: 'user', entityId: 'u2' },
            },
            { type: 'text', text: '!' },
          ],
        },
      ],
    });

    expect(text).toBe('Hello @Alice!');
  });
});


