import * as mime from 'mime-types';
import * as path from 'node:path';

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath);
  return mime.contentType(ext) || 'application/octet-stream';
}
