import { integrationLinkPatterns } from '@docmost/editor-ext';
import { buildGitHubPatterns } from './github-patterns';

function firstMatch(patterns: { type: string; regex: RegExp }[], url: string) {
  for (const pattern of patterns) {
    const match = url.match(pattern.regex);
    if (match) return { type: pattern.type, groups: match.slice(1) };
  }
  return null;
}

// Each of these matched before the guard; the browser resolves them to a different path.
const RESOLVED_ELSEWHERE = [
  'https://github.com/a/b/pull/1/../../../../evil/x/pull/2',
  'https://github.com/../user?x=/pull/1',
  'https://github.com/a/b/pull/1/%2e%2e/%2E%2E/%2e./.%2e/evil/x/pull/2',
  'https://github.com/a/b/pull/1/commits/abc123/../../../../../evil/x/pull/2',
  'https://github.com/a/b/issues/1/..',
  'https://github.com/a/b/issues/1/..?x=1',
  'https://github.com/a/b/commit/abc123/./x',
  'https://github.com/a/b/blob/main/../../../evil/x/blob/main/secret.txt',
  'https://github.com/a/b/pulls/../../evil/x/pulls',
  'https://github.com/a/b/releases/./tag/v1',
  'https://github.com/a/b/issues/created_by/../../../evil/x/issues',
  'https://github.com/a/b/pull/1\\..\\..\\evil',
  'https://github.com/a\\b/c/pull/1',
];

const STILL_MATCHED: [string, string, (string | undefined)[]][] = [
  ['https://github.com/o/.github/pull/1', 'github-pr', ['o', '.github', '1']],
  ['https://github.com/o/my..repo/issues/2', 'github-issue', ['o', 'my..repo', '2']],
  ['https://github.com/o/.../issues/3', 'github-issue', ['o', '...', '3']],
  ['https://github.com/o/r/pull/1#discussion_r1/../..', 'github-pr', ['o', 'r', '1']],
  ['https://github.com/o/r/pulls?q=../../x', 'github-pulls-list', ['o', 'r']],
  [
    'https://github.com/o/r/blob/main/.github/workflows/ci.yml#L1-L3',
    'github-file',
    ['o', 'r', 'main', '.github/workflows/ci.yml', '1', '3'],
  ],
  [
    'https://github.com/o/r/blob/main/src/..hidden/a.ts',
    'github-file',
    ['o', 'r', 'main', 'src/..hidden/a.ts', undefined, undefined],
  ],
  ['https://github.com/o/r/commit/abc123', 'github-commit', ['o', 'r', 'abc123']],
  ['https://github.com/o/r', 'github-repo', ['o', 'r']],
  ['https://github.com/my-org_1/repo.name-x/pull/1', 'github-pr', ['my-org_1', 'repo.name-x', '1']],
];

// The browser opens the repo or owner for these; the rest of the route is query or fragment.
const ROUTE_IN_QUERY_OR_FRAGMENT = [
  'https://github.com/o/r?x=/pull/1',
  'https://github.com/o/r#x/pull/1',
  'https://github.com/o?x=/r/issues/1',
  'https://github.com/o/r?/commit/abc123',
  'https://github.com/o/r?x=/pull/1/commits/abc123',
  'https://github.com/o/r#/blob/main/a.ts',
  'https://github.com/o/r?x=/pulls',
  'https://github.com/o/r#/releases',
  'https://github.com/o/r?x=/issues',
];

describe('buildGitHubPatterns', () => {
  const patterns = buildGitHubPatterns('https://github.com');
  const byType = (type: string) => patterns.find((p) => p.type === type)!;
  const crafted = 'https://github.com/o/r/pulls/' + '?'.repeat(40000) + '\n';

  it('keeps the pulls and releases list patterns linear on a crafted input', () => {
    for (const type of ['github-pulls-list', 'github-releases-list']) {
      const started = process.hrtime.bigint();
      expect(byType(type).regex.test(crafted)).toBe(false);
      expect(Number(process.hrtime.bigint() - started) / 1e6).toBeLessThan(100);
    }
  });

  it.each([
    ['https://github.com/o/r/pulls', 'github-pulls-list'],
    ['https://github.com/o/r/pulls/', 'github-pulls-list'],
    ['https://github.com/o/r/pulls?q=is%3Aopen', 'github-pulls-list'],
    ['https://github.com/o/r/pulls/extra', 'github-pulls-list'],
    ['https://github.com/o/r/releases', 'github-releases-list'],
    ['https://github.com/o/r/releases/tag/v1.0.0?x=1', 'github-releases-list'],
  ])('still matches %s as %s', (url, type) => {
    expect(byType(type).regex.test(url)).toBe(true);
  });

  it('does not match a longer path segment as the list', () => {
    expect(byType('github-pulls-list').regex.test('https://github.com/o/r/pullsx')).toBe(false);
  });

  it.each(ROUTE_IN_QUERY_OR_FRAGMENT)('does not match %s', (url) => {
    expect(firstMatch(patterns, url)).toBeNull();
  });

  describe('paths the browser would resolve elsewhere', () => {
    it.each(RESOLVED_ELSEWHERE)('does not match %s', (url) => {
      expect(firstMatch(patterns, url)).toBeNull();
    });

    it.each(STILL_MATCHED)('still matches %s as %s', (url, type, groups) => {
      expect(firstMatch(patterns, url)).toEqual({ type, groups });
    });

    it('guards a GitHub Enterprise host the same way', () => {
      const enterprise = buildGitHubPatterns('https://github.acme.com');
      expect(
        firstMatch(enterprise, 'https://github.acme.com/a/b/pull/1/../../../../evil/x/pull/2'),
      ).toBeNull();
      expect(firstMatch(enterprise, 'https://github.acme.com/../user?x=/pull/1')).toBeNull();
      expect(firstMatch(enterprise, 'https://github.acme.com/o/r/pull/1')).toEqual({
        type: 'github-pr',
        groups: ['o', 'r', '1'],
      });
    });

    it('stays linear on hostile input', () => {
      const crafted = [
        'https://github.com/' + 'a/'.repeat(30000),
        'https://github.com/o/r/pull/1' + '/.x'.repeat(10000),
        'https://github.com/o/r/blob/main/' + '%2e'.repeat(10000) + '\n',
      ];
      for (const input of crafted) {
        const started = process.hrtime.bigint();
        for (const pattern of patterns) pattern.regex.test(input);
        expect(Number(process.hrtime.bigint() - started) / 1e6).toBeLessThan(100);
      }
    });

    it.each([
      ...RESOLVED_ELSEWHERE,
      ...ROUTE_IN_QUERY_OR_FRAGMENT,
      ...STILL_MATCHED.map(([url]) => url),
    ])(
      'agrees with the editor patterns on %s',
      (url) => {
        const editorPatterns = integrationLinkPatterns.filter(
          (pattern) => pattern.provider === 'github',
        );
        expect(firstMatch(editorPatterns, url)).toEqual(firstMatch(patterns, url));
      },
    );
  });
});
