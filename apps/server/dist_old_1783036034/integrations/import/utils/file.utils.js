"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTaskStatus = exports.FileImportSource = exports.FileTaskType = void 0;
exports.getFileTaskFolderPath = getFileTaskFolderPath;
exports.extractZip = extractZip;
exports.cleanUrlString = cleanUrlString;
const yauzl = require("yauzl");
const path = require("path");
const fs = require("node:fs");
var FileTaskType;
(function (FileTaskType) {
    FileTaskType["Import"] = "import";
    FileTaskType["Export"] = "export";
})(FileTaskType || (exports.FileTaskType = FileTaskType = {}));
var FileImportSource;
(function (FileImportSource) {
    FileImportSource["Generic"] = "generic";
    FileImportSource["Notion"] = "notion";
    FileImportSource["Confluence"] = "confluence";
})(FileImportSource || (exports.FileImportSource = FileImportSource = {}));
var FileTaskStatus;
(function (FileTaskStatus) {
    FileTaskStatus["Processing"] = "processing";
    FileTaskStatus["Success"] = "success";
    FileTaskStatus["Failed"] = "failed";
})(FileTaskStatus || (exports.FileTaskStatus = FileTaskStatus = {}));
function getFileTaskFolderPath(type, workspaceId) {
    switch (type) {
        case FileTaskType.Import:
            return `${workspaceId}/imports`;
        case FileTaskType.Export:
            return `${workspaceId}/exports`;
    }
}
async function extractZip(source, target) {
    return extractZipInternal(source, target, true);
}
function extractZipInternal(source, target, allowNested) {
    return new Promise((resolve, reject) => {
        yauzl.open(source, { lazyEntries: true, decodeStrings: false, autoClose: true }, (err, zipfile) => {
            if (err)
                return reject(err);
            if (allowNested && zipfile.entryCount === 1) {
                zipfile.readEntry();
                zipfile.once('entry', (entry) => {
                    const name = entry.fileName.toString('utf8').replace(/^\/+/, '');
                    const isZip = !/\/$/.test(entry.fileName) &&
                        name.toLowerCase().endsWith('.zip');
                    if (isZip) {
                        const nestedPath = source.endsWith('.zip')
                            ? source.slice(0, -4) + '.inner.zip'
                            : source + '.inner.zip';
                        zipfile.openReadStream(entry, (openErr, rs) => {
                            if (openErr)
                                return reject(openErr);
                            const ws = fs.createWriteStream(nestedPath);
                            rs.on('error', reject);
                            ws.on('error', reject);
                            ws.on('finish', () => {
                                zipfile.close();
                                extractZipInternal(nestedPath, target, false)
                                    .then(() => {
                                    fs.unlinkSync(nestedPath);
                                    resolve();
                                })
                                    .catch(reject);
                            });
                            rs.pipe(ws);
                        });
                    }
                    else {
                        zipfile.close();
                        extractZipInternal(source, target, false).then(resolve, reject);
                    }
                });
                zipfile.once('error', reject);
                return;
            }
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
                if (/\/$/.test(name)) {
                    try {
                        fs.mkdirSync(fullPath, { recursive: true });
                    }
                    catch (mkdirErr) {
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
                try {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                }
                catch (mkdirErr) {
                    if (mkdirErr.code === 'ENAMETOOLONG') {
                        console.warn(`Skipping file directory creation (path too long): ${fullPath}`);
                        zipfile.readEntry();
                        return;
                    }
                    return reject(mkdirErr);
                }
                zipfile.openReadStream(entry, (openErr, rs) => {
                    if (openErr)
                        return reject(openErr);
                    let ws;
                    try {
                        ws = fs.createWriteStream(fullPath);
                    }
                    catch (openWsErr) {
                        if (openWsErr.code === 'ENAMETOOLONG') {
                            console.warn(`Skipping file write (path too long): ${fullPath}`);
                            zipfile.readEntry();
                            return;
                        }
                        return reject(openWsErr);
                    }
                    rs.on('error', (err) => reject(err));
                    ws.on('error', (err) => {
                        if (err.code === 'ENAMETOOLONG') {
                            console.warn(`Skipping file write on stream (path too long): ${fullPath}`);
                            zipfile.readEntry();
                        }
                        else {
                            reject(err);
                        }
                    });
                    ws.on('finish', () => zipfile.readEntry());
                    rs.pipe(ws);
                });
            });
            zipfile.on('end', () => resolve());
            zipfile.on('error', (err) => reject(err));
        });
    });
}
function cleanUrlString(url) {
    if (!url)
        return null;
    const [mainUrl] = url.split('?', 1);
    return mainUrl;
}
//# sourceMappingURL=file.utils.js.map