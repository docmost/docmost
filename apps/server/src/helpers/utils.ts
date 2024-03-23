import * as path from 'path';

export function generateHostname(name: string): string {
  let hostname = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  hostname = hostname.substring(0, 30);
  return hostname;
}

export const envPath = path.resolve(process.cwd(), '..', '..', '.env');
