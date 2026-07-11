"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAttachmentCandidates = buildAttachmentCandidates;
exports.resolveRelativeAttachmentPath = resolveRelativeAttachmentPath;
exports.collectMarkdownAndHtmlFiles = collectMarkdownAndHtmlFiles;
exports.stripNotionID = stripNotionID;
exports.extractNotionPartialId = extractNotionPartialId;
exports.encodeFilePath = encodeFilePath;
exports.readDocmostMetadata = readDocmostMetadata;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path = require("path");
async function buildAttachmentCandidates(extractDir) {
    const map = new Map();
    async function walk(dir) {
        for (const ent of await fs_1.promises.readdir(dir, { withFileTypes: true })) {
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                await walk(abs);
            }
            else {
                if (['.md', '.html'].includes(path.extname(ent.name).toLowerCase())) {
                    continue;
                }
                const rel = path.relative(extractDir, abs).split(path.sep).join('/');
                map.set(rel, abs);
            }
        }
    }
    await walk(extractDir);
    return map;
}
function resolveRelativeAttachmentPath(raw, pageDir, attachmentCandidates) {
    let mainRel = raw.replace(/^\.?\/+/, '');
    try {
        mainRel = decodeURIComponent(mainRel);
    }
    catch (err) {
        common_1.Logger.warn(`URI malformed for attachment path: ${mainRel}. Falling back to raw path.`, 'ImportUtils');
    }
    const confluenceStripped = mainRel.replace(/^download\/attachments\//, 'attachments/');
    const fallback = path
        .normalize(path.join(pageDir, mainRel))
        .split(path.sep)
        .join('/');
    if (attachmentCandidates.has(mainRel)) {
        return mainRel;
    }
    if (confluenceStripped !== mainRel && attachmentCandidates.has(confluenceStripped)) {
        return confluenceStripped;
    }
    if (attachmentCandidates.has(fallback)) {
        return fallback;
    }
    return null;
}
async function collectMarkdownAndHtmlFiles(dir) {
    const results = [];
    async function walk(current) {
        const entries = await fs_1.promises.readdir(current, { withFileTypes: true });
        for (const ent of entries) {
            const fullPath = path.join(current, ent.name);
            if (ent.isDirectory()) {
                await walk(fullPath);
            }
            else if (['.md', '.html'].includes(path.extname(ent.name).toLowerCase())) {
                results.push(fullPath);
            }
        }
    }
    await walk(dir);
    return results;
}
function stripNotionID(fileName) {
    const notionIdPattern = /[ -]?[a-z0-9]{32}$/i;
    const partialIdPattern = / [a-f0-9]{4}-[a-f0-9]{4}$/i;
    return fileName
        .replace(notionIdPattern, '')
        .replace(partialIdPattern, '')
        .trim();
}
function extractNotionPartialId(folderName) {
    const match = folderName.match(/ ([a-f0-9]{4})-([a-f0-9]{4})$/i);
    if (!match)
        return null;
    return { prefix: match[1].toLowerCase(), suffix: match[2].toLowerCase() };
}
function encodeFilePath(filePath) {
    return filePath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}
async function readDocmostMetadata(extractDir) {
    const metadataPath = path.join(extractDir, 'docmost-metadata.json');
    try {
        const content = await fs_1.promises.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(content);
        if (metadata.source === 'docmost' && metadata.pages) {
            return metadata;
        }
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=import.utils.js.map