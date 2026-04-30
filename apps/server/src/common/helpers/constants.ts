import * as path from 'path';

export const APP_DATA_PATH = 'data';
const LOCAL_STORAGE_DIR = `${APP_DATA_PATH}/storage`;

export const LOCAL_STORAGE_PATH =
  path.basename(process.cwd()) === 'server'
    ? path.resolve(process.cwd(), '..', '..', LOCAL_STORAGE_DIR)
    : path.resolve(process.cwd(), LOCAL_STORAGE_DIR);

export function getPageTitle(title: string | null | undefined): string {
  return title || 'untitled';
}
