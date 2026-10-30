import { Readable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';
import {
  APP_ROOT_PATH,
  CONTAINER_STORAGE_PATH,
  LOCAL_STORAGE_PATH,
} from '../../common/helpers/constants';

export function streamToBuffer(readableStream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    readableStream.on('data', (chunk) => chunks.push(chunk));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

export function resolveLocalStoragePath(configuredPath?: string): string {
  if (configuredPath) {
    return path.resolve(APP_ROOT_PATH, configuredPath);
  }

  if (
    !fs.existsSync(CONTAINER_STORAGE_PATH) ||
    isMountedVolume(LOCAL_STORAGE_PATH)
  ) {
    return LOCAL_STORAGE_PATH;
  }

  return CONTAINER_STORAGE_PATH;
}

// a volume or bind mount lives on a different device than the image's filesystem
function isMountedVolume(dir: string): boolean {
  try {
    return fs.statSync(dir).dev !== fs.statSync(APP_ROOT_PATH).dev;
  } catch {
    return false;
  }
}
