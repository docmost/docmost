import { ValidationPipe } from '@nestjs/common';
import { RecentlyUpdatedDto } from './recently-updated.dto';

const spaceId = '53d63f2a-87be-415b-b340-bca58bd24ebe';
const otherSpaceId = '019b193d-a530-78a2-8c7c-159675ff7791';
const pipe = new ValidationPipe({ transform: true, whitelist: true });
const validate = (payload: object) =>
  pipe.transform(payload, {
    type: 'body',
    metatype: RecentlyUpdatedDto,
  });

describe('RecentlyUpdatedDto', () => {
  it('defaults to the current space and retains literal label names', async () => {
    await expect(
      validate({ spaceId, labels: ['-old', '+release', '?missing'] }),
    ).resolves.toEqual({
      spaceId,
      labels: ['-old', '+release', '?missing'],
      excludeLabels: [],
      match: 'any',
      scope: 'current',
      spaceIds: [],
      excludeSpaceIds: [],
      limit: 15,
    });
  });

  it.each(['workspace', 'spaces'])(
    'keeps an explicit %s scope with no selected IDs',
    async (scope) => {
      await expect(validate({ spaceId, scope })).resolves.toMatchObject({
        scope,
        spaceIds: [],
        excludeSpaceIds: [],
      });
    },
  );

  it('accepts included and excluded named spaces and labels', async () => {
    const options = {
      spaceId,
      limit: 2,
      scope: 'spaces',
      spaceIds: [spaceId, otherSpaceId],
      excludeSpaceIds: [otherSpaceId],
      labels: ['+review'],
      excludeLabels: ['?retired'],
      match: 'all',
    };
    await expect(validate(options)).resolves.toEqual(options);
  });

  it.each([
    { spaceId: 'slug' },
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { limit: '10' },
    { scope: 'some' },
    { scope: null },
    { spaceIds: 'space-key' },
    { spaceIds: ['@self'] },
    { spaceIds: ['*'] },
    { spaceIds: [`+${spaceId}`] },
    { spaceIds: Array(101).fill(spaceId) },
    { excludeSpaceIds: null },
    { excludeSpaceIds: ['@favorite'] },
    { excludeSpaceIds: ['*'] },
    { excludeSpaceIds: [`-${spaceId}`] },
    { excludeSpaceIds: Array(101).fill(otherSpaceId) },
    { labels: null },
    { excludeLabels: null },
    { excludeLabels: [' '] },
    { excludeLabels: Array(101).fill('x') },
    { excludeLabels: ['x'.repeat(257)] },
    { match: 'some' },
    { match: null },
    { labels: [12] },
    { labels: ['  '] },
    { labels: Array(101).fill('x') },
    { labels: ['x'.repeat(257)] },
  ])('rejects invalid request shape %o', async (options) => {
    await expect(validate({ spaceId, ...options })).rejects.toMatchObject({
      status: 400,
    });
  });
});
