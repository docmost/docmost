import * as path from 'path';

export const APP_DATA_PATH = 'data';
const LOCAL_STORAGE_DIR = `${APP_DATA_PATH}/storage`;

export const APP_ROOT_PATH = path.resolve(process.cwd(), '..', '..');

export const LOCAL_STORAGE_PATH = path.resolve(
  APP_ROOT_PATH,
  LOCAL_STORAGE_DIR,
);

export const CONTAINER_STORAGE_PATH = '/var/lib/docmost/storage';

export function getPageTitle(
  title: string | null | undefined,
  isBase?: boolean,
): string {
  return title || (isBase ? 'Untitled base' : 'untitled');
}
