import { MentionNotificationService } from './mentions.service';

describe('MentionNotificationService', () => {
  it('enqueues mention-email jobs for user mention nodes (excluding self) and respects sent dedupe', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const generalQueue = { add } as any;
    const mentionEmailNotificationRepo = {
      findSentMentionIds: jest.fn().mockResolvedValue(new Set(['m2'])),
    } as any;
    const environmentService = {
      getMentionEmailCooldownMs: jest.fn().mockReturnValue(30_000),
    } as any;

    const svc = new MentionNotificationService(
      generalQueue,
      mentionEmailNotificationRepo,
      environmentService,
    );

    await svc.scheduleMentionEmails({
      workspaceId: 'w1',
      actorUserId: 'u1',
      source: 'page',
      pageId: 'p1',
      prosemirrorJson: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'hi ' },
              {
                type: 'mention',
                attrs: {
                  id: 'm1',
                  label: 'Alice',
                  entityType: 'user',
                  entityId: 'u2',
                  creatorId: 'u1',
                },
              },
              {
                type: 'mention',
                attrs: {
                  id: 'm2',
                  label: 'Bob',
                  entityType: 'user',
                  entityId: 'u3',
                  creatorId: 'u1',
                },
              },
              {
                type: 'mention',
                attrs: {
                  id: 'm3',
                  label: 'Self',
                  entityType: 'user',
                  entityId: 'u1',
                  creatorId: 'u1',
                },
              },
            ],
          },
        ],
      },
      cooldownMs: 30_000,
    });

    // m2 is already sent -> skip; m3 is self -> skip; enqueue m1 only
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe('mention-email');
    expect(add.mock.calls[0][1]).toMatchObject({
      workspaceId: 'w1',
      source: 'page',
      mentionId: 'm1',
      mentionedUserId: 'u2',
      actorUserId: 'u1',
      pageId: 'p1',
    });
    expect(add.mock.calls[0][2]).toMatchObject({ delay: 30_000 });
  });
});


