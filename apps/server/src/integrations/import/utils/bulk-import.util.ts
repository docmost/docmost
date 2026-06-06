import * as JSZip from 'jszip';
import * as path from 'path';

/**
 * Normalizes an uploaded file name into a safe relative zip entry path:
 * - converts backslashes to forward slashes
 * - drops empty / "." / ".." segments (prevents path traversal)
 * Preserves the remaining folder structure so the generic importer can rebuild
 * the page hierarchy from sub-folders.
 */
export function sanitizeZipEntryPath(name: string): string {
  const normalized = (name || '').replace(/\\/g, '/');
  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..');
  return segments.join('/');
}

/**
 * Packs the uploaded files into a single in-memory zip that the existing
 * generic import pipeline (processGenericImport) can consume. Duplicate entry
 * paths are de-duplicated with a numeric suffix.
 */
export async function buildBulkImportZip(
  files: Array<{ filename: string; buffer: Buffer }>,
): Promise<Buffer> {
  const zip = new JSZip();
  const usedPaths = new Set<string>();

  for (const file of files) {
    let relPath = sanitizeZipEntryPath(file.filename);
    if (!relPath) {
      continue;
    }

    if (usedPaths.has(relPath)) {
      const ext = path.extname(relPath);
      const base = relPath.slice(0, relPath.length - ext.length);
      let counter = 1;
      while (usedPaths.has(`${base}-${counter}${ext}`)) {
        counter += 1;
      }
      relPath = `${base}-${counter}${ext}`;
    }

    usedPaths.add(relPath);
    zip.file(relPath, file.buffer);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
