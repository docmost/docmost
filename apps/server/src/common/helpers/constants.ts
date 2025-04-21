import * as path from 'path';

export const APP_DATA_PATH = 'data';
const LOCAL_STORAGE_DIR = `${APP_DATA_PATH}/storage`;

export const LOCAL_STORAGE_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  LOCAL_STORAGE_DIR,
);
