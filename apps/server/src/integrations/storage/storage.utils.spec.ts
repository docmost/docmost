import * as fs from 'fs';
import * as path from 'path';
import { resolveLocalStoragePath } from './storage.utils';
import {
  APP_ROOT_PATH,
  CONTAINER_STORAGE_PATH,
  LOCAL_STORAGE_PATH,
} from '../../common/helpers/constants';

describe('resolveLocalStoragePath', () => {
  const IMAGE_DEVICE = 1;
  const VOLUME_DEVICE = 2;

  function mockFs(opts: {
    containerDirExists: boolean;
    legacyDevice?: number;
  }) {
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation(
        (p) => p === CONTAINER_STORAGE_PATH && opts.containerDirExists,
      );
    jest.spyOn(fs, 'statSync').mockImplementation(((p: string) => {
      if (p === APP_ROOT_PATH) return { dev: IMAGE_DEVICE };
      if (p === LOCAL_STORAGE_PATH && opts.legacyDevice !== undefined) {
        return { dev: opts.legacyDevice };
      }
      throw new Error('ENOENT');
    }) as any);
  }

  afterEach(() => jest.restoreAllMocks());

  it('uses an absolute configured path as is', () => {
    mockFs({ containerDirExists: true, legacyDevice: VOLUME_DEVICE });
    expect(resolveLocalStoragePath('/mnt/docmost')).toBe('/mnt/docmost');
  });

  it('resolves a relative configured path against the app root', () => {
    mockFs({ containerDirExists: false });
    expect(resolveLocalStoragePath('uploads')).toBe(
      path.resolve(APP_ROOT_PATH, 'uploads'),
    );
  });

  it('ignores an empty configured path', () => {
    mockFs({ containerDirExists: false });
    expect(resolveLocalStoragePath('')).toBe(LOCAL_STORAGE_PATH);
  });

  it('keeps the legacy path outside the container image', () => {
    mockFs({ containerDirExists: false });
    expect(resolveLocalStoragePath()).toBe(LOCAL_STORAGE_PATH);
  });

  it('keeps the legacy path when a volume is mounted on it', () => {
    mockFs({ containerDirExists: true, legacyDevice: VOLUME_DEVICE });
    expect(resolveLocalStoragePath()).toBe(LOCAL_STORAGE_PATH);
  });

  it('uses the container path when nothing is mounted on the legacy path', () => {
    mockFs({ containerDirExists: true, legacyDevice: IMAGE_DEVICE });
    expect(resolveLocalStoragePath()).toBe(CONTAINER_STORAGE_PATH);
  });

  it('uses the container path when the legacy path is missing', () => {
    mockFs({ containerDirExists: true });
    expect(resolveLocalStoragePath()).toBe(CONTAINER_STORAGE_PATH);
  });
});
