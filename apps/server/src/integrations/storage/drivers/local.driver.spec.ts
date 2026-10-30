import { tmpdir } from 'os';
import { join, resolve, sep } from 'path';
import * as fs from 'fs-extra';
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

describe('LocalDriver.delete', () => {
  let sandbox: string;
  let root: string;
  let driver: LocalDriver;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(join(tmpdir(), 'local-driver-'));
    root = join(sandbox, 'storage');
    await fs.mkdir(root);
    driver = new LocalDriver({ storagePath: root });
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it('removes the uuid directory along with its only file', async () => {
    await driver.upload('workspace-id/files/uuid/file.pdf', Buffer.from('x'));

    await driver.delete('workspace-id/files/uuid/file.pdf');

    expect(await fs.pathExists(join(root, 'workspace-id/files/uuid'))).toBe(false);
    expect(await fs.pathExists(join(root, 'workspace-id/files'))).toBe(true);
  });

  it('keeps a shared directory that still holds other files', async () => {
    await driver.upload('workspace-id/avatars/a.png', Buffer.from('a'));
    await driver.upload('workspace-id/avatars/b.png', Buffer.from('b'));

    await driver.delete('workspace-id/avatars/a.png');

    expect(await fs.pathExists(join(root, 'workspace-id/avatars/a.png'))).toBe(false);
    expect(await fs.pathExists(join(root, 'workspace-id/avatars/b.png'))).toBe(true);
  });

  it('resolves when the file and its directory are already gone', async () => {
    await expect(
      driver.delete('workspace-id/files/uuid/file.pdf'),
    ).resolves.toBeUndefined();
  });

  it('keeps the storage root when its last file is deleted', async () => {
    await driver.upload('file.pdf', Buffer.from('x'));

    await driver.delete('file.pdf');

    expect(await fs.pathExists(root)).toBe(true);
  });

  describe('paths resolving to the storage root', () => {
    it.each(['', '.', './', 'workspace-id/..', 'workspace-id/files/../..'])(
      'rejects %j and keeps the stored files',
      async (input) => {
        await driver.upload('workspace-id/files/uuid/file.pdf', Buffer.from('x'));

        await expect(driver.delete(input)).rejects.toThrow('Invalid file path');

        expect(await fs.pathExists(join(root, 'workspace-id/files/uuid/file.pdf'))).toBe(true);
      },
    );
  });

  describe('paths leaving the storage root', () => {
    let outsideFile: string;

    beforeEach(async () => {
      outsideFile = join(sandbox, 'storage-evil/secret.txt');
      await fs.outputFile(outsideFile, 'x');
    });

    it.each([
      '..',
      '../storage-evil/secret.txt',
      'workspace-id/../../storage-evil/secret.txt',
      'workspace-id/files/uuid/../../../../storage-evil/secret.txt',
    ])('rejects %j and keeps the file', async (input) => {
      await expect(driver.delete(input)).rejects.toThrow('Invalid file path');

      expect(await fs.pathExists(outsideFile)).toBe(true);
    });

    it('rejects an absolute path and keeps the file', async () => {
      await expect(driver.delete(outsideFile)).rejects.toThrow('Invalid file path');

      expect(await fs.pathExists(outsideFile)).toBe(true);
    });

    it.each(['%2e%2e/storage-evil/secret.txt', '..%2Fstorage-evil%2Fsecret.txt'])(
      'treats %j as a literal name',
      async (input) => {
        await driver.upload(input, Buffer.from('x'));

        await driver.delete(input);

        expect(await fs.pathExists(join(root, input))).toBe(false);
        expect(await fs.pathExists(outsideFile)).toBe(true);
      },
    );
  });

  describe('symlinks', () => {
    let target: string;

    beforeEach(async () => {
      target = join(sandbox, 'outside-dir');
      await fs.outputFile(join(target, 'only.txt'), 'x');
      await fs.ensureDir(join(root, 'workspace-id/files/uuid'));
    });

    it('removes a link without touching its target', async () => {
      await fs.symlink(target, join(root, 'workspace-id/files/uuid/file.pdf'));

      await driver.delete('workspace-id/files/uuid/file.pdf');

      expect(await fs.pathExists(join(root, 'workspace-id/files/uuid'))).toBe(false);
      expect(await fs.pathExists(join(target, 'only.txt'))).toBe(true);
    });

    it('keeps a linked directory after its last file is deleted through it', async () => {
      const link = join(root, 'workspace-id/files/link');
      await fs.symlink(target, link);

      await driver.delete('workspace-id/files/link/only.txt');

      expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
      expect(await fs.pathExists(target)).toBe(true);
    });
  });
});
