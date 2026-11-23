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
    spaceId: 'space',
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

it('omits recently updated blocks from public pages and synced blocks', async () => {
  const feed = {
    type: 'recentlyUpdated',
    attrs: { spaces: ['@self'], labels: ['private'], limit: 7 },
  };
  const paragraph = (text: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  });
  const before = paragraph('Before');
  const after = paragraph('After');
  const table = (blocks: JSONContent[]) => ({
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: [{ type: 'tableCell', content: blocks }],
      },
    ],
  });
  const doc = (...content: JSONContent[]) => ({ type: 'doc', content });
  const original = doc(
    feed,
    before,
    { type: 'recentlyUpdated' },
    table([feed, feed]),
    after,
    feed,
  );
  const page = {
    id: 'page',
    workspaceId: 'workspace',
    content: jsonToNode(original).toJSON(),
  } as Page;
  const saved = structuredClone(page.content);
  const expected = jsonToNode(
    doc(before, table([{ type: 'paragraph' }]), after),
  ).toJSON();
  const service = new ShareService(null, null, null, null, null, null);

  expect(await service.updatePublicAttachments(page)).toEqual(expected);
  const [synced] = await service.sanitizeTransclusionItemsForPublic(
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
  expect(synced).toHaveProperty('content', expected);
  const empty = await service.updatePublicAttachments({
    ...page,
    content: jsonToNode(doc(feed)).toJSON(),
  });
  expect(empty).toEqual(jsonToNode(doc({ type: 'paragraph' })).toJSON());
  expect(page.content).toEqual(saved);
});

it('omits label filters from shared pages and transclusions even inside a callout', async () => {
  const node = {
    type: 'itemsByLabel',
    attrs: { labels: ['internal-runbook'], heading: 'Internal handbook' },
  };
  const content = {
    type: 'doc',
    content: [node, { type: 'callout', content: [node] }],
  };
  const page = {
    id: 'page',
    workspaceId: 'workspace',
    content,
  } as unknown as Page;
  const service = new ShareService(null, null, null, null, null, null);
  const publicContent = await service.updatePublicAttachments(page);
  const serialized = JSON.stringify(publicContent);
  expect(serialized).not.toMatch(
    /itemsByLabel|internal-runbook|Internal handbook/,
  );
  expect(serialized).toContain('callout');
  expect(() => jsonToNode(publicContent).check()).not.toThrow();
  const [block] = await service.sanitizeTransclusionItemsForPublic(
    [
      {
        sourcePageId: page.id,
        transclusionId: 'block',
        content,
        sourceUpdatedAt: new Date(),
      },
    ],
    page.workspaceId,
  );
  expect(block).toHaveProperty('content', publicContent);
  expect(JSON.stringify(page.content)).toContain('internal-runbook');
});
