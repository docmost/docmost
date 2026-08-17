import { collapseBlankLines } from './text.utils';

describe('collapseBlankLines', () => {
  it.each([
    ['a\n\n\n\nb', 'a\n\nb'],
    ['a\n\nb', 'a\n\nb'],
    ['a\nb', 'a\nb'],
    ['\n\n\n\na\n\n\n', '\n\na\n\n'],
    ['no newlines', 'no newlines'],
    ['', ''],
  ])('collapses %j to %j', (input, expected) => {
    expect(collapseBlankLines(input)).toBe(expected);
  });
});
