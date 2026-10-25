import { integrationLinkPatterns } from '@docmost/editor-ext';
import { linearPatterns } from './linear-patterns';

function firstMatch(url: string) {
  for (const pattern of linearPatterns) {
    const match = url.match(pattern.regex);
    if (match) return { type: pattern.type, groups: match.slice(1) };
  }
  return null;
}

const MATCHES: [string, string, (string | undefined)[]][] = [
  ['https://linear.app/acme/issue/ABC-1', 'linear-issue', ['acme', 'ABC-1', undefined]],
  ['https://linear.app/acme/issue/ABC-1/fix-the-login', 'linear-issue', ['acme', 'ABC-1', 'fix-the-login']],
  ['https://linear.app/acme/issue/ABC-1#comment-1/../..', 'linear-issue', ['acme', 'ABC-1', undefined]],
  ['https://linear.app/acme/issue/ABC-1?q=../..', 'linear-issue', ['acme', 'ABC-1', undefined]],
  ['https://linear.app/acme/project/mobile-app-1b9607f47174/overview', 'linear-project', ['acme', 'mobile-app-1b9607f47174']],
  ['https://linear.app/acme/initiative/q4-goals-8a7b6c5d4e3f', 'linear-initiative', ['acme', 'q4-goals-8a7b6c5d4e3f']],
  ['https://linear.app/acme/view/..x', 'linear-view', ['acme', '..x']],
];

// Each of these matched before the guard; the browser resolves them to a different path.
const NON_MATCHES = [
  'https://linear.app/acme/issue/ABC-1/../../../evil/issue/XYZ-2',
  'https://linear.app/acme/issue/ABC-1/%2e%2e/%2E%2e/%2e./evil/issue/XYZ-2',
  'https://linear.app/acme/issue/ABC-1/slug/..',
  'https://linear.app/acme/project/p/../../../evil/project/q',
  'https://linear.app/acme/initiative/i\\..\\..\\evil',
  'https://linear.app/./view/v1',
  'https://linear.app/acme/view/v1/.',
  'https://linear.app/acme/view/v1/..?x=1',
];

describe('linearPatterns', () => {
  it.each(MATCHES)('matches %s as %s', (url, type, groups) => {
    expect(firstMatch(url)).toEqual({ type, groups });
  });

  it.each(NON_MATCHES)('does not match %s', (url) => {
    expect(firstMatch(url)).toBeNull();
  });

  it('are the four patterns the editor matches pasted links with, in the same order', () => {
    const shape = ({ type, regex }: { type: string; regex: RegExp }) => ({
      type,
      source: regex.source,
      flags: regex.flags,
    });

    expect(linearPatterns).toHaveLength(4);
    expect(
      integrationLinkPatterns.filter((pattern) => pattern.provider === 'linear').map(shape),
    ).toEqual(linearPatterns.map(shape));
  });
});
