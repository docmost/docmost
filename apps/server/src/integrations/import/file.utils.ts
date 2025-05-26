import * as yauzl from 'yauzl';
import * as path from 'path';
import * as fs from 'node:fs';

export enum FileTaskType {
  Import = 'import',
  Export = 'export',
}

export enum FileImportType {
  Generic = 'generic',
  Notion = 'notion',
  Confluence = 'confluence',
}

export enum FileTaskStatus {
  Pending = 'pending',
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

export function extractZip(source: string, target: string) {
  //https://github.com/Surfer-Org
  return new Promise((resolve, reject) => {
    yauzl.open(
      source,
      { lazyEntries: true, decodeStrings: false, autoClose: true },
      (err, zipfile) => {
        if (err) return reject(err);

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          const name = entry.fileName.toString('utf8'); // or 'cp437' if you need the original DOS charset
          const safeName = name.replace(/^\/+/, ''); // strip any leading slashes

          const fullPath = path.join(target, safeName);
          const directory = path.dirname(fullPath);

          // <-- skip all macOS metadata
          if (safeName.startsWith('__MACOSX/')) {
            return zipfile.readEntry();
          }

          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            try {
              fs.mkdirSync(fullPath, { recursive: true });
              zipfile.readEntry();
            } catch (err) {
              reject(err);
            }
          } else {
            // File entry
            try {
              fs.mkdirSync(directory, { recursive: true });
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) return reject(err);
                const writeStream = fs.createWriteStream(fullPath);
                readStream.on('end', () => {
                  writeStream.end();
                  zipfile.readEntry();
                });
                readStream.pipe(writeStream);
              });
            } catch (err) {
              reject(err);
            }
          }
        });

        zipfile.on('end', resolve);
        zipfile.on('error', reject);
      },
    );
  });
}

export function cleanUrlString(url: string): string {
  const [maybePath] = url.split('?', 1);
  return maybePath;
}
