import { ValidationPipe } from '@nestjs/common';
import { RecentlyUpdatedDto } from './recently-updated.dto';

const spaceId = '53d63f2a-87be-415b-b340-bca58bd24ebe';
const pipe = new ValidationPipe({ transform: true, whitelist: true });
const validate = (payload: object) =>
  pipe.transform(payload, {
    type: 'body',
    metatype: RecentlyUpdatedDto,
  });

describe('RecentlyUpdatedDto', () => {
  it('uses bounded defaults for omitted options and retains literal label names', async () => {
    await expect(
      validate({ spaceId, labels: ['-old', '?missing'] }),
    ).resolves.toEqual({
      spaceId,
      labels: ['-old', '?missing'],
      excludeLabels: [],
      match: 'any',
      spaces: [],
      excludeSpaces: [],
      spaceMatch: 'any',
      limit: 15,
    });
  });

  it.each([
    ['unresolved authors', ['?missing']],
    ['an oversized author list', Array(101).fill('x'.repeat(257))],
    ['malformed authors', null],
  ])('ignores %s from earlier clients', async (_name, authors) => {
    const options = {
      spaceId,
      limit: 2,
      spaces: ['@all'],
      excludeSpaces: ['@personal'],
      spaceMatch: 'all',
      labels: ['+review'],
      excludeLabels: ['?retired'],
      match: 'all',
    };
    await expect(validate({ ...options, authors })).resolves.toEqual(options);
  });

  it.each([
    { spaceId: 'slug' },
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { limit: '10' },
    { spaces: '@all' },
    { excludeSpaces: null },
    { excludeSpaces: Array(101).fill('@self') },
    { spaceMatch: 'some' },
    { labels: null },
    { excludeLabels: null },
    { excludeLabels: [' '] },
    { excludeLabels: Array(101).fill('x') },
    { excludeLabels: ['x'.repeat(257)] },
    { match: 'some' },
    { match: null },
    { labels: [12] },
    { spaces: ['  '] },
    { spaces: Array(101).fill('@self') },
    { labels: ['x'.repeat(257)] },
  ])('rejects invalid request shape %o', async (options) => {
    await expect(validate({ spaceId, ...options })).rejects.toMatchObject({
      status: 400,
    });
  });
});
