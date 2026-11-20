import type { Page } from '@docmost/db/types/entity.types';
import type { JSONContent } from '@tiptap/core';
import { jsonToNode } from '../../collaboration/collaboration.util';
import { ShareService } from './share.service';

it('removes unfilled prompts and comments from public pages and synced blocks', async () => {
  const publicLink = {
    type: 'link',
    attrs: { href: 'https://example.com/handbook' },
  };
  const answer = { type: 'text', text: 'Handbook', marks: [publicLink] };
  const comment = { type: 'comment', attrs: { commentId: 'private' } };
  const hint = {
    type: 'templatePlaceholder',
    attrs: { hint: 'Enter the internal owner' },
    marks: [{ type: 'link', attrs: { href: 'https://example.com/internal' } }],
  };
  const list = (content: JSONContent[]) => ({
    type: 'bulletList',
    content: [{ type: 'listItem', content: [{ type: 'paragraph', content }] }],
  });
  const content = {
    type: 'doc',
    content: [
      list([hint]),
      {
        type: 'paragraph',
        content: [hint, { ...answer, marks: [publicLink, comment] }],
      },
    ],
  };
  const expected = jsonToNode({
    type: 'doc',
    content: [list([]), { type: 'paragraph', content: [answer] }],
  }).toJSON();
  const page = {
    id: 'page',
    workspaceId: 'workspace',
    content: jsonToNode(content).toJSON(),
  } as Page;
  const original = structuredClone(page.content);
  const service = new ShareService(null, null, null, null, null, null);

  expect(await service.updatePublicAttachments(page)).toEqual(expected);
  const [block] = await service.sanitizeTransclusionItemsForPublic(
    [
      {
        sourcePageId: page.id,
        transclusionId: 'block',
        content: page.content,
        sourceUpdatedAt: new Date(),
      },
    ],
    page.workspaceId,
  );
  expect(block).toHaveProperty('content', expected);
  expect(page.content).toEqual(original);
});
