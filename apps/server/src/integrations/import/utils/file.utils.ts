import * as yauzl from 'yauzl';
import * as path from 'path';
import * as fs from 'node:fs';

export enum FileTaskType {
  Import = 'import',
  Export = 'export',
}

export enum FileImportSource {
  Generic = 'generic',
  Notion = 'notion',
  Confluence = 'confluence',
}

export enum FileTaskStatus {
  Processing = 'processing',
  Success = 'success',
  Failed = 'failed',
}

export function getFileTaskFolderPath(
  type: FileTaskType,
  workspaceId: string,
): string {
  switch (type) {
    case FileTaskType.Import:
      return `${workspaceId}/imports`;
    case FileTaskType.Export:
      return `${workspaceId}/exports`;
  }
}

const COMPRESSION_HEADROOM = 10;
const MIN_EXTRACTED_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 250_000;

type SizeBudget = { used: number; max: number };

export async function extractZip(
  source: string,
  target: string,
): Promise<void> {
  const { size: compressedSize } = await fs.promises.stat(source);
  const max = Math.max(
    compressedSize * COMPRESSION_HEADROOM,
    MIN_EXTRACTED_BYTES,
  );
  return extractZipInternal(source, target, true, { used: 0, max });
}

function extractZipInternal(
  source: string,
  target: string,
  allowNested: boolean,
  budget: SizeBudget,
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      source,
      {
        lazyEntries: true,
        decodeStrings: false,
        autoClose: true,
        validateEntrySizes: true,
      },
      (err, zipfile) => {
        if (err) return reject(err);

        // Handle one level of nested ZIP if allowed
        if (allowNested && zipfile.entryCount === 1) {
          zipfile.readEntry();
          zipfile.once('entry', (entry) => {
            const name = entry.fileName.toString('utf8').replace(/^\/+/, '');
            const isZip =
              !/\/$/.test(entry.fileName) &&
              name.toLowerCase().endsWith('.zip');
            if (isZip) {
              // temporary name to avoid overwriting file
              const nestedPath = source.endsWith('.zip')
                ? source.slice(0, -4) + '.inner.zip'
                : source + '.inner.zip';

              budget.used += entry.uncompressedSize;
              if (budget.used > budget.max) {
                return reject(
                  new Error(
                    'Import archive exceeds the allowed extracted size limit',
                  ),
                );
              }

              zipfile.openReadStream(entry, (openErr, rs) => {
                if (openErr) return reject(openErr);
                const ws = fs.createWriteStream(nestedPath);
                rs.on('error', reject);
                ws.on('error', reject);
                ws.on('finish', () => {
                  zipfile.close();
                  extractZipInternal(nestedPath, target, false, budget)
                    .then(() => {
                      fs.unlinkSync(nestedPath);
                      resolve();
                    })
                    .catch(reject);
                });
                rs.pipe(ws);
              });
            } else {
              zipfile.close();
              extractZipInternal(source, target, false, budget).then(
                resolve,
                reject,
              );
            }
          });
          zipfile.once('error', reject);
          return;
        }

        if (zipfile.entryCount > MAX_ENTRIES) {
          zipfile.close();
          return reject(new Error('Import archive has too many entries'));
        }

        // Normal extraction
        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          const name = entry.fileName.toString('utf8');
          const safe = name.replace(/^\/+/, '');

          const validationError = yauzl.validateFileName(safe);
          if (validationError) {
            console.warn(`Skipping invalid entry (${validationError})`);
            zipfile.readEntry();
            return;
          }

          if (safe.startsWith('__MACOSX/')) {
            zipfile.readEntry();
            return;
          }

          const fullPath = path.join(target, safe);

          const resolved = path.resolve(fullPath);
          const targetResolved = path.resolve(target);

          if (!resolved.startsWith(targetResolved + path.sep)) {
            console.warn(`Skipping entry (path outside target): ${safe}`);
            zipfile.readEntry();
            return;
          }

          // Handle directories
          if (/\/$/.test(name)) {
            try {
              fs.mkdirSync(fullPath, { recursive: true });
            } catch (mkdirErr: any) {
              if (mkdirErr.code === 'ENAMETOOLONG') {
                console.warn(`Skipping directory (path too long): ${fullPath}`);
                zipfile.readEntry();
                return;
              }
              return reject(mkdirErr);
            }
            zipfile.readEntry();
            return;
          }

          budget.used += entry.uncompressedSize;
          if (budget.used > budget.max) {
            return reject(
              new Error(
                'Import archive exceeds the allowed extracted size limit',
              ),
            );
          }

          // Handle files
          try {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          } catch (mkdirErr: any) {
            if (mkdirErr.code === 'ENAMETOOLONG') {
              console.warn(
                `Skipping file directory creation (path too long): ${fullPath}`,
              );
              zipfile.readEntry();
              return;
            }
            return reject(mkdirErr);
          }

          zipfile.openReadStream(entry, (openErr, rs) => {
            if (openErr) return reject(openErr);

            let ws: fs.WriteStream;
            try {
              ws = fs.createWriteStream(fullPath);
            } catch (openWsErr: any) {
              if (openWsErr.code === 'ENAMETOOLONG') {
                console.warn(
                  `Skipping file write (path too long): ${fullPath}`,
                );
                zipfile.readEntry();
                return;
              }
              return reject(openWsErr);
            }

            rs.on('error', (err) => reject(err));
            ws.on('error', (err) => {
              if ((err as any).code === 'ENAMETOOLONG') {
                console.warn(
                  `Skipping file write on stream (path too long): ${fullPath}`,
                );
                zipfile.readEntry();
              } else {
                reject(err);
              }
            });
            ws.on('finish', () => zipfile.readEntry());
            rs.pipe(ws);
          });
        });

        zipfile.on('end', () => resolve());
        zipfile.on('error', (err) => reject(err));
      },
    );
  });
}

export function cleanUrlString(url: string): string {
  if (!url) return null;
  const [mainUrl] = url.split('?', 1);
  return mainUrl;
}
