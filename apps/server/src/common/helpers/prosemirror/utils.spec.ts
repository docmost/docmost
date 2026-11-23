import { extractInternalLinkSlugIds, updateUserMentionLabels } from './utils';

const ADA = '0190c3c5-8b7d-7c3e-9a53-6f3f2a1b4c5d';
const BOB = '0190c3c5-8b7d-7c3e-9a53-6f3f2a1b4c5e';
const PAGE = '0190c3c5-8b7d-7c3e-9a53-6f3f2a1b4c5f';

type UserName = { id: string; name: string };

function userMention(entityId: string, label: string) {
  return {
    type: 'mention',
    attrs: { id: `mention-${label}`, label, entityType: 'user', entityId },
  };
}

function pageMention(entityId: string, label: string) {
  return {
    type: 'mention',
    attrs: {
      id: `mention-${label}`,
      label,
      entityType: 'page',
      entityId,
      slugId: 'slug',
    },
  };
}

function paragraph(...content: object[]) {
  return { type: 'paragraph', content };
}

function doc(...content: object[]) {
  return { type: 'doc', content };
}

function mentionLabels(node: any): string[] {
  if (node?.type === 'mention') return [node.attrs.label];
  return (node?.content ?? []).flatMap(mentionLabels);
}

function lookup(users: UserName[]) {
  return jest.fn(async (_userIds: string[]) => users);
}

describe('extractInternalLinkSlugIds', () => {
  it('deduplicates linked images and text while ignoring external and file destinations', () => {
    const linkedImage = (href: string) => ({
      type: 'image',
      attrs: { src: '/api/files/attachment/tile.png', href },
    });
    const content = doc(
      linkedImage('/p/guide-abc123#overview'),
      paragraph({
        type: 'text',
        text: 'Guide',
        marks: [
          {
            type: 'link',
            attrs: { href: '/s/team/p/guide-abc123', internal: true },
          },
        ],
      }),
      linkedImage('/s/team/p/another-def456?view=full'),
      linkedImage('https://elsewhere.example/s/team/p/other-xyz'),
      linkedImage('/api/files/attachment/manual.pdf'),
    );
    expect(extractInternalLinkSlugIds(content)).toEqual(['abc123', 'def456']);
  });
});

describe('updateUserMentionLabels', () => {
  it('puts current names on user mentions anywhere in the document', async () => {
    const json = doc(
      paragraph(userMention(ADA, 'Ada')),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph(userMention(BOB, 'Bob'))] },
        ],
      },
    );

    const result = await updateUserMentionLabels(
      json,
      lookup([
        { id: ADA, name: 'Ada Lovelace' },
        { id: BOB, name: 'Bob Moses' },
      ]),
    );

    expect(mentionLabels(result)).toEqual(['Ada Lovelace', 'Bob Moses']);
  });

  it('keeps the saved label for users the lookup does not return', async () => {
    const json = doc(
      paragraph(userMention(ADA, 'Ada'), userMention(BOB, 'Bob')),
    );

    const result = await updateUserMentionLabels(
      json,
      lookup([{ id: ADA, name: 'Ada Lovelace' }]),
    );

    expect(mentionLabels(result)).toEqual(['Ada Lovelace', 'Bob']);
  });

  it('leaves page mentions alone', async () => {
    const json = doc(
      paragraph(pageMention(PAGE, 'Roadmap'), userMention(ADA, 'Ada')),
    );
    const findNames = lookup([
      { id: PAGE, name: 'Not a user' },
      { id: ADA, name: 'Ada Lovelace' },
    ]);

    const result = await updateUserMentionLabels(json, findNames);

    expect(mentionLabels(result)).toEqual(['Roadmap', 'Ada Lovelace']);
    expect(findNames).toHaveBeenCalledWith([ADA]);
  });

  it('looks up each valid user id once', async () => {
    const json = doc(
      paragraph(
        userMention(ADA, 'Ada'),
        userMention(ADA, 'Ada again'),
        userMention('not-a-uuid', 'Broken'),
      ),
    );
    const findNames = lookup([]);

    await updateUserMentionLabels(json, findNames);

    expect(findNames).toHaveBeenCalledTimes(1);
    expect(findNames).toHaveBeenCalledWith([ADA]);
  });

  it('skips the lookup without user mentions', async () => {
    const json = doc(paragraph({ type: 'text', text: 'hello' }));
    const findNames = lookup([]);

    expect(await updateUserMentionLabels(json, findNames)).toBe(json);
    expect(await updateUserMentionLabels(null, findNames)).toBeNull();
    expect(findNames).not.toHaveBeenCalled();
  });

  it('does not change the stored document', async () => {
    const json = doc(paragraph(userMention(ADA, 'Ada')));

    await updateUserMentionLabels(
      json,
      lookup([{ id: ADA, name: 'Ada Lovelace' }]),
    );

    expect(mentionLabels(json)).toEqual(['Ada']);
  });
});
