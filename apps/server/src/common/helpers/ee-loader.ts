import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Enterprise code is absent from community builds, so it can't be imported statically.
export function importEe(path: string): Promise<any> {
  return import(`../../ee/${path}.js`);
}

// Only for synchronous callers: throws if the module graph has a top-level await.
export function requireEe(path: string): any {
  return require(`../../ee/${path}.js`);
}
