import { resolve, sep } from 'path';
import { LocalDriver } from './local.driver';

type FullPath = (filePath: string) => string;

describe('LocalDriver._fullPath', () => {
  const ROOT = resolve('/data/storage');
  const driver = new LocalDriver({ storagePath: ROOT });
  const fullPath = ((driver as any)._fullPath as FullPath).bind(driver);

  describe('legitimate inputs (behavior preserved)', () => {
    it.each([
      ['workspace-id/avatars/uuid.png', `${ROOT}${sep}workspace-id${sep}avatars${sep}uuid.png`],
      ['workspace-id/files/uuid/file.pdf', `${ROOT}${sep}workspace-id${sep}files${sep}uuid${sep}file.pdf`],
      ['a/b/c/d/e.bin', `${ROOT}${sep}a${sep}b${sep}c${sep}d${sep}e.bin`],
      ['', ROOT],
      ['.', ROOT],
      ['./x/y.png', `${ROOT}${sep}x${sep}y.png`],
      ['a//b', `${ROOT}${sep}a${sep}b`],
      ['a/b/../c', `${ROOT}${sep}a${sep}c`],
    ])('resolves %j to %j', (input, expected) => {
      expect(fullPath(input)).toBe(expected);
    });
  });

  describe('traversal rejected', () => {
    it.each([
      '../etc/passwd',
      '../../../etc/passwd',
      'workspace/../../../etc/passwd',
      '..',
      '../..',
      'a/../../..',
    ])('throws for %j', (input) => {
      expect(() => fullPath(input)).toThrow('Invalid file path');
    });
  });

  describe('absolute path rejected', () => {
    it.each([
      '/etc/passwd',
      '/root/.ssh/id_rsa',
      sep + 'absolute',
    ])('throws for %j', (input) => {
      expect(() => fullPath(input)).toThrow('Invalid file path');
    });
  });

  describe('prefix-confusion rejected', () => {
    it('rejects a sibling directory whose name starts with the storage root', () => {
      const siblingDriver = new LocalDriver({ storagePath: '/data/storage' });
      const siblingFullPath = ((siblingDriver as any)._fullPath as FullPath).bind(siblingDriver);
      // Attempt to reach /data/storage-evil/secret by traversal:
      // resolve('/data/storage', '../storage-evil/secret') === '/data/storage-evil/secret'
      // Without the `+ sep` guard, a startsWith check would match.
      expect(() => siblingFullPath('../storage-evil/secret')).toThrow('Invalid file path');
    });
  });

  describe('storage root itself', () => {
    it('accepts the root when input resolves to it', () => {
      expect(fullPath('')).toBe(ROOT);
      expect(fullPath('.')).toBe(ROOT);
      expect(fullPath('a/..')).toBe(ROOT);
    });
  });
});
