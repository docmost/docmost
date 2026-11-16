import { ForbiddenException } from '@nestjs/common';
import {
  normalizeInvitationMessage,
  resolveWorkspaceUserListStatus,
} from './workspace.util';

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

describe('resolveWorkspaceUserListStatus', () => {
  it.each([
    [undefined, 'active'],
    ['active', 'active'],
    ['deactivated', 'deactivated'],
    ['deleted', 'deleted'],
    ['all', 'all'],
  ] as const)('gives a manager %j as %j', (status, expected) => {
    expect(resolveWorkspaceUserListStatus(status, true)).toBe(expected);
  });

  it.each([
    [undefined, 'active'],
    ['active', 'active'],
    ['all', 'active'],
  ] as const)('gives a member %j as %j', (status, expected) => {
    expect(resolveWorkspaceUserListStatus(status, false)).toBe(expected);
  });

  it.each(['deactivated', 'deleted'] as const)(
    'refuses a member asking for %j',
    (status) => {
      expect(() => resolveWorkspaceUserListStatus(status, false)).toThrow(
        ForbiddenException,
      );
    },
  );
});
