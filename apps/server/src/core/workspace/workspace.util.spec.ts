import { normalizeInvitationMessage } from './workspace.util';

describe('normalizeInvitationMessage', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['   \n  ', null],
    ['https://evil.com', null],
    ['alice@acme.com', null],
    [
      'Read the guide at docs.example.com before Monday.',
      'Read the guide at before Monday.',
    ],
    ['Hi team,\r\n\r\n\r\n\r\nWelcome!', 'Hi team,\n\nWelcome!'],
    ['  Hello   there  \n  second line  ', 'Hello there\nsecond line'],
    ['a\t\tb', 'a b'],
    ['a\rb', 'a\nb'],
    ['a\n \nb', 'a\n\nb'],
    ['Line one https://x.com\nLine two', 'Line one\nLine two'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeInvitationMessage(input)).toBe(expected);
  });
});
