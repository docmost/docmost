"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ImportAttachmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportAttachmentService = void 0;
const common_1 = require("@nestjs/common");
const path = require("path");
const nestjs_kysely_1 = require("nestjs-kysely");
const file_utils_1 = require("../utils/file.utils");
const storage_service_1 = require("../../storage/storage.service");
const node_fs_1 = require("node:fs");
const fs_1 = require("fs");
const stream_1 = require("stream");
const helpers_1 = require("../../../common/helpers");
const uuid_1 = require("uuid");
const attachment_utils_1 = require("../../../core/attachment/attachment.utils");
const attachment_constants_1 = require("../../../core/attachment/attachment.constants");
const import_formatter_1 = require("../utils/import-formatter");
const import_utils_1 = require("../utils/import.utils");
const image_dimensions_1 = require("image-dimensions");
const cheerio_1 = require("cheerio");
const p_limit_1 = require("p-limit");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../queue/constants");
let ImportAttachmentService = ImportAttachmentService_1 = class ImportAttachmentService {
    constructor(storageService, db, attachmentQueue) {
        this.storageService = storageService;
        this.db = db;
        this.attachmentQueue = attachmentQueue;
        this.logger = new common_1.Logger(ImportAttachmentService_1.name);
        this.CONCURRENT_UPLOADS = 3;
        this.MAX_RETRIES = 2;
        this.RETRY_DELAY = 2000;
    }
    async processAttachments(opts) {
        const { html, pageRelativePath, extractDir, pageId, fileTask, attachmentCandidates, pageAttachments = [], isConfluenceImport, } = opts;
        const attachmentTasks = [];
        const limit = (0, p_limit_1.default)(this.CONCURRENT_UPLOADS);
        const uploadStats = {
            total: 0,
            completed: 0,
            failed: 0,
            failedFiles: [],
        };
        const processed = new Map();
        const { drawioPairs, skipFiles } = this.analyzeAttachments(pageAttachments, isConfluenceImport);
        const drawioSvgMap = new Map();
        for (const [drawioHref, pair] of drawioPairs) {
            if (!pair.drawioFile)
                continue;
            const drawioAbsPath = attachmentCandidates.get(drawioHref);
            if (!drawioAbsPath)
                continue;
            const pngAbsPath = pair.pngFile
                ? attachmentCandidates.get(pair.pngFile.href)
                : undefined;
            try {
                const svgBuffer = await this.createDrawioSvg(drawioAbsPath, pngAbsPath);
                const attachmentId = (0, uuid_1.v7)();
                const fileName = 'diagram.drawio.svg';
                const storageFilePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.File, fileTask.workspaceId)}/${attachmentId}/${fileName}`;
                const apiFilePath = `/api/files/${attachmentId}/${fileName}`;
                attachmentTasks.push(async () => {
                    try {
                        const stream = stream_1.Readable.from(svgBuffer);
                        await this.storageService.uploadStream(storageFilePath, stream, {
                            recreateClient: true,
                        });
                        await this.db
                            .insertInto('attachments')
                            .values({
                            id: attachmentId,
                            filePath: storageFilePath,
                            fileName: fileName,
                            fileSize: svgBuffer.length,
                            mimeType: 'image/svg+xml',
                            type: 'file',
                            fileExt: '.svg',
                            creatorId: fileTask.creatorId,
                            workspaceId: fileTask.workspaceId,
                            pageId,
                            spaceId: fileTask.spaceId,
                        })
                            .execute();
                        uploadStats.completed++;
                    }
                    catch (error) {
                        uploadStats.failed++;
                        uploadStats.failedFiles.push(fileName);
                        this.logger.error(`Failed to upload Draw.io SVG ${fileName}:`, error);
                    }
                });
                drawioSvgMap.set(drawioHref, { attachmentId, apiFilePath, fileName });
                if (pair.pngFile) {
                    drawioSvgMap.set(pair.pngFile.href, {
                        attachmentId,
                        apiFilePath,
                        fileName,
                    });
                }
            }
            catch (error) {
                this.logger.error(`Failed to process Draw.io pair ${pair.baseName}:`, error);
            }
        }
        const pageDir = path.dirname(pageRelativePath);
        const attachmentNameByRelPath = new Map();
        for (const attachment of pageAttachments) {
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(attachment.href, pageDir, attachmentCandidates);
            if (relPath && attachment.fileName) {
                attachmentNameByRelPath.set(relPath, attachment.fileName);
                const dir = path.posix.dirname(relPath);
                const aliasKey = `${dir}/${attachment.fileName}`;
                if (!attachmentCandidates.has(aliasKey)) {
                    attachmentCandidates.set(aliasKey, attachmentCandidates.get(relPath));
                    attachmentNameByRelPath.set(aliasKey, attachment.fileName);
                }
            }
        }
        const uploadOnce = (relPath) => {
            const abs = attachmentCandidates.get(relPath);
            const attachmentId = (0, uuid_1.v7)();
            const realName = attachmentNameByRelPath.get(relPath);
            const baseName = realName || path.basename(abs);
            const ext = path.extname(baseName);
            const fileNameWithExt = (0, helpers_1.sanitizeFileName)(path.basename(baseName, ext)) + ext.toLowerCase();
            const storageFilePath = `${(0, attachment_utils_1.getAttachmentFolderPath)(attachment_constants_1.AttachmentType.File, fileTask.workspaceId)}/${attachmentId}/${fileNameWithExt}`;
            const apiFilePath = `/api/files/${attachmentId}/${fileNameWithExt}`;
            attachmentTasks.push(() => this.uploadWithRetry({
                abs,
                storageFilePath,
                attachmentId,
                fileNameWithExt,
                ext,
                pageId,
                fileTask,
                uploadStats,
            }));
            return {
                attachmentId,
                storageFilePath,
                apiFilePath,
                fileNameWithExt,
                abs,
            };
        };
        const processFile = (relPath) => {
            const cached = processed.get(relPath);
            if (cached)
                return cached;
            const fresh = uploadOnce(relPath);
            processed.set(relPath, fresh);
            return fresh;
        };
        const $ = (0, cheerio_1.load)(html);
        for (const imgEl of $('img').toArray()) {
            const $img = $(imgEl);
            const src = (0, file_utils_1.cleanUrlString)($img.attr('src') ?? '');
            if (!src || src.startsWith('http'))
                continue;
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(src, pageDir, attachmentCandidates);
            if (!relPath)
                continue;
            const drawioSvg = drawioSvgMap.get(relPath);
            if (drawioSvg) {
                const $drawio = $('<div>')
                    .attr('data-type', 'drawio')
                    .attr('data-src', drawioSvg.apiFilePath)
                    .attr('data-title', 'diagram')
                    .attr('data-width', '100%')
                    .attr('data-align', 'center')
                    .attr('data-attachment-id', drawioSvg.attachmentId);
                $img.replaceWith($drawio);
                (0, import_formatter_1.unwrapFromParagraph)($, $drawio);
                continue;
            }
            const { attachmentId, apiFilePath, abs } = processFile(relPath);
            let width = $img.attr('width');
            const height = $img.attr('height');
            const align = $img.attr('data-align') ?? 'center';
            if (!width) {
                try {
                    const buf = await fs_1.promises.readFile(abs);
                    const natural = (0, image_dimensions_1.imageDimensionsFromData)(new Uint8Array(buf));
                    if (natural) {
                        width = height
                            ? String(Math.round((natural.width / natural.height) * Number(height)))
                            : String(natural.width);
                    }
                }
                catch {
                }
                if (!width) {
                    width = '600';
                }
            }
            $img
                .attr('src', apiFilePath)
                .attr('data-attachment-id', attachmentId)
                .attr('width', width)
                .attr('height', height)
                .attr('data-align', align);
            (0, import_formatter_1.unwrapFromParagraph)($, $img);
        }
        for (const vidEl of $('video').toArray()) {
            const $vid = $(vidEl);
            const src = (0, file_utils_1.cleanUrlString)($vid.attr('src') ?? '');
            if (!src || src.startsWith('http'))
                continue;
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(src, pageDir, attachmentCandidates);
            if (!relPath)
                continue;
            const { attachmentId, apiFilePath } = processFile(relPath);
            const width = $vid.attr('width') ?? '100%';
            const align = $vid.attr('data-align') ?? 'center';
            $vid
                .attr('src', apiFilePath)
                .attr('data-attachment-id', attachmentId)
                .attr('width', width)
                .attr('data-align', align);
            (0, import_formatter_1.unwrapFromParagraph)($, $vid);
        }
        for (const audEl of $('audio').toArray()) {
            const $aud = $(audEl);
            const src = (0, file_utils_1.cleanUrlString)($aud.attr('src') ?? '');
            if (!src || src.startsWith('http'))
                continue;
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(src, pageDir, attachmentCandidates);
            if (!relPath)
                continue;
            const { attachmentId, apiFilePath } = processFile(relPath);
            $aud
                .attr('src', apiFilePath)
                .attr('data-attachment-id', attachmentId);
            (0, import_formatter_1.unwrapFromParagraph)($, $aud);
        }
        for (const el of $('div[data-type="attachment"]').toArray()) {
            const $oldDiv = $(el);
            const rawUrl = (0, file_utils_1.cleanUrlString)($oldDiv.attr('data-attachment-url') ?? '');
            if (!rawUrl || rawUrl.startsWith('http'))
                continue;
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(rawUrl, pageDir, attachmentCandidates);
            if (!relPath)
                continue;
            const { attachmentId, apiFilePath, abs } = processFile(relPath);
            const fileName = path.basename(abs);
            const mime = (0, helpers_1.getMimeType)(abs);
            const $newDiv = $('<div>')
                .attr('data-type', 'attachment')
                .attr('data-attachment-url', apiFilePath)
                .attr('data-attachment-name', fileName)
                .attr('data-attachment-mime', mime)
                .attr('data-attachment-id', attachmentId);
            $oldDiv.replaceWith($newDiv);
            (0, import_formatter_1.unwrapFromParagraph)($, $newDiv);
        }
        for (const aEl of $('a').toArray()) {
            const $a = $(aEl);
            const href = (0, file_utils_1.cleanUrlString)($a.attr('href') ?? '');
            if (!href || href.startsWith('http'))
                continue;
            const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(href, pageDir, attachmentCandidates);
            if (!relPath)
                continue;
            const drawioSvg = drawioSvgMap.get(relPath);
            if (drawioSvg) {
                const $drawio = $('<div>')
                    .attr('data-type', 'drawio')
                    .attr('data-src', drawioSvg.apiFilePath)
                    .attr('data-title', 'diagram')
                    .attr('data-width', '100%')
                    .attr('data-align', 'center')
                    .attr('data-attachment-id', drawioSvg.attachmentId);
                $a.replaceWith($drawio);
                (0, import_formatter_1.unwrapFromParagraph)($, $drawio);
                continue;
            }
            if (skipFiles.has(relPath)) {
                $a.remove();
                continue;
            }
            const { attachmentId, apiFilePath, abs } = processFile(relPath);
            const ext = path.extname(relPath).toLowerCase();
            const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac', '.aac']);
            if (ext === '.pdf') {
                const $pdf = $('<div>')
                    .attr('data-type', 'pdf')
                    .attr('src', apiFilePath)
                    .attr('data-attachment-id', attachmentId)
                    .attr('width', '800')
                    .attr('height', '600');
                $a.replaceWith($pdf);
                (0, import_formatter_1.unwrapFromParagraph)($, $pdf);
            }
            else if (ext === '.mp4') {
                const $video = $('<video>')
                    .attr('src', apiFilePath)
                    .attr('data-attachment-id', attachmentId)
                    .attr('width', '100%')
                    .attr('data-align', 'center');
                $a.replaceWith($video);
                (0, import_formatter_1.unwrapFromParagraph)($, $video);
            }
            else if (audioExtensions.has(ext)) {
                const $audio = $('<audio>')
                    .attr('src', apiFilePath)
                    .attr('data-attachment-id', attachmentId);
                $a.replaceWith($audio);
                (0, import_formatter_1.unwrapFromParagraph)($, $audio);
            }
            else {
                const confAliasName = $a.attr('data-linked-resource-default-alias');
                let attachmentName = path.basename(abs);
                if (confAliasName)
                    attachmentName = confAliasName;
                const $div = $('<div>')
                    .attr('data-type', 'attachment')
                    .attr('data-attachment-url', apiFilePath)
                    .attr('data-attachment-name', attachmentName)
                    .attr('data-attachment-mime', (0, helpers_1.getMimeType)(abs))
                    .attr('data-attachment-id', attachmentId);
                $a.replaceWith($div);
                (0, import_formatter_1.unwrapFromParagraph)($, $div);
            }
        }
        for (const type of ['excalidraw', 'drawio']) {
            for (const el of $(`div[data-type="${type}"]`).toArray()) {
                const $oldDiv = $(el);
                const rawSrc = (0, file_utils_1.cleanUrlString)($oldDiv.attr('data-src') ?? '');
                if (!rawSrc || rawSrc.startsWith('http'))
                    continue;
                const relPath = (0, import_utils_1.resolveRelativeAttachmentPath)(rawSrc, pageDir, attachmentCandidates);
                if (!relPath)
                    continue;
                const { attachmentId, apiFilePath, abs } = processFile(relPath);
                const fileName = path.basename(abs);
                const width = $oldDiv.attr('data-width') || '600';
                const align = $oldDiv.attr('data-align') || 'center';
                const $newDiv = $('<div>')
                    .attr('data-type', type)
                    .attr('data-src', apiFilePath)
                    .attr('data-title', fileName)
                    .attr('data-width', width)
                    .attr('data-align', align)
                    .attr('data-attachment-id', attachmentId);
                $oldDiv.replaceWith($newDiv);
                (0, import_formatter_1.unwrapFromParagraph)($, $newDiv);
            }
        }
        const usedAttachmentIds = new Set();
        $.root()
            .find('[data-attachment-id]')
            .each((_, el) => {
            const attachmentId = $(el).attr('data-attachment-id');
            if (attachmentId) {
                usedAttachmentIds.add(attachmentId);
            }
        });
        for (const [drawioHref, pair] of drawioPairs) {
            const drawioSvg = drawioSvgMap.get(drawioHref);
            if (!drawioSvg)
                continue;
            if (usedAttachmentIds.has(drawioSvg.attachmentId)) {
                continue;
            }
            const $drawio = $('<div>')
                .attr('data-type', 'drawio')
                .attr('data-src', drawioSvg.apiFilePath)
                .attr('data-title', 'diagram')
                .attr('data-width', '600')
                .attr('data-align', 'center')
                .attr('data-attachment-id', drawioSvg.attachmentId);
            $.root().append($drawio);
        }
        for (const attachment of pageAttachments) {
            const { href, fileName, mimeType } = attachment;
            if (skipFiles.has(href)) {
                continue;
            }
            if (drawioSvgMap.has(href)) {
                continue;
            }
            const resolvedHref = (0, import_utils_1.resolveRelativeAttachmentPath)(href, pageDir, attachmentCandidates);
            if (!resolvedHref)
                continue;
            const absPath = attachmentCandidates.get(resolvedHref);
            const alreadyProcessed = processed.has(resolvedHref) ||
                (absPath &&
                    Array.from(processed.values()).some((entry) => entry.abs === absPath));
            if (alreadyProcessed) {
                continue;
            }
            const { attachmentId, apiFilePath, abs } = processFile(resolvedHref);
            const mime = mimeType || (0, helpers_1.getMimeType)(abs);
            const $attachmentDiv = $('<div>')
                .attr('data-type', 'attachment')
                .attr('data-attachment-url', apiFilePath)
                .attr('data-attachment-name', fileName)
                .attr('data-attachment-mime', mime)
                .attr('data-attachment-id', attachmentId);
            $.root().append($attachmentDiv);
        }
        uploadStats.total = attachmentTasks.length;
        if (uploadStats.total > 0) {
            try {
                await Promise.all(attachmentTasks.map((task) => limit(task)));
            }
            catch (err) {
                this.logger.error('Import attachment upload error', err);
            }
            this.logger.debug(`Upload completed: ${uploadStats.completed}/${uploadStats.total} successful, ${uploadStats.failed} failed`);
            if (uploadStats.failed > 0) {
                this.logger.warn(`Failed to upload ${uploadStats.failed} files:`, uploadStats.failedFiles);
            }
        }
        const elementsNeedingSize = $('[data-attachment-id]:not([data-attachment-size]):not([data-size])');
        for (const element of elementsNeedingSize.toArray()) {
            const $el = $(element);
            const attachmentId = $el.attr('data-attachment-id');
            if (!attachmentId)
                continue;
            const processedEntry = Array.from(processed.values()).find((entry) => entry.attachmentId === attachmentId);
            if (processedEntry) {
                try {
                    const stat = await fs_1.promises.stat(processedEntry.abs);
                    const sizeStr = stat.size.toString();
                    const tagName = $el.prop('tagName')?.toLowerCase();
                    if (tagName === 'audio' || $el.attr('data-type') === 'pdf') {
                        $el.attr('data-size', sizeStr);
                    }
                    else {
                        $el.attr('data-attachment-size', sizeStr);
                    }
                }
                catch (error) {
                    this.logger.debug(`Could not get size for ${processedEntry.abs}:`, error);
                }
            }
        }
        return $.root().html() || '';
    }
    analyzeAttachments(attachments, isConfluenceImport) {
        const drawioPairs = new Map();
        const skipFiles = new Set();
        if (!isConfluenceImport) {
            return { drawioPairs, skipFiles };
        }
        const drawioFiles = [];
        const pngByBaseName = new Map();
        const nonDrawioExtensions = new Set([
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.svg',
            '.txt',
            '.pdf',
            '.doc',
            '.docx',
            '.xls',
            '.xlsx',
            '.csv',
            '.zip',
            '.tar',
            '.gz',
        ]);
        for (const attachment of attachments) {
            const { fileName, mimeType, href } = attachment;
            const fileNameLower = fileName.toLowerCase();
            if (fileName.endsWith('.tmp') || fileName.includes('~drawio~')) {
                skipFiles.add(href);
                continue;
            }
            if (mimeType === 'application/vnd.jgraph.mxfile') {
                const ext = fileNameLower.substring(fileNameLower.lastIndexOf('.'));
                if (!nonDrawioExtensions.has(ext)) {
                    drawioFiles.push(attachment);
                }
                else {
                }
            }
            if (mimeType === 'image/png' || fileNameLower.endsWith('.png')) {
                const baseNames = [];
                if (fileName.endsWith('.drawio.png')) {
                    baseNames.push(fileName.slice(0, -11));
                }
                else if (fileName.endsWith('.png')) {
                    baseNames.push(fileName.slice(0, -4));
                }
                for (const baseName of baseNames) {
                    if (!pngByBaseName.has(baseName)) {
                        pngByBaseName.set(baseName, []);
                    }
                    pngByBaseName.get(baseName).push(attachment);
                }
            }
        }
        for (const drawio of drawioFiles) {
            let baseName;
            if (drawio.fileName.endsWith('.drawio')) {
                baseName = drawio.fileName.slice(0, -7);
            }
            else {
                baseName = drawio.fileName;
            }
            const candidatePngs = pngByBaseName.get(baseName) || [];
            let matchingPng;
            const drawioIdMatch = drawio.href.match(/\/(\d+)\.\w+$/);
            const drawioId = drawioIdMatch ? drawioIdMatch[1] : null;
            if (drawioId) {
                for (const png of candidatePngs) {
                    const pngIdMatch = png.href.match(/\/(\d+)\.png$/);
                    const pngId = pngIdMatch ? pngIdMatch[1] : null;
                    if (pngId && drawioId) {
                        const idDiff = Math.abs(parseInt(pngId) - parseInt(drawioId));
                        if (idDiff <= 30) {
                            if (png.fileName === `${baseName}.drawio.png` ||
                                (!drawio.fileName.endsWith('.drawio') &&
                                    png.fileName === `${baseName}.png`)) {
                                matchingPng = png;
                                break;
                            }
                        }
                    }
                }
            }
            if (!matchingPng) {
                for (const png of candidatePngs) {
                    if (png.fileName === `${baseName}.drawio.png`) {
                        matchingPng = png;
                        break;
                    }
                    if (!drawio.fileName.endsWith('.drawio') &&
                        png.fileName === `${baseName}.png`) {
                        matchingPng = png;
                        break;
                    }
                }
            }
            if (matchingPng) {
                this.logger.debug(`Found Draw.io pair: ${drawio.fileName} -> ${matchingPng.fileName}`);
            }
            else {
                this.logger.debug(`No PNG found for Draw.io file: ${drawio.fileName}`);
            }
            const pair = {
                drawioFile: drawio,
                pngFile: matchingPng,
                baseName,
            };
            drawioPairs.set(drawio.href, pair);
            skipFiles.add(drawio.href);
            if (matchingPng) {
                skipFiles.add(matchingPng.href);
                const remainingPngs = pngByBaseName
                    .get(baseName)
                    ?.filter((png) => png.href !== matchingPng.href);
                if (remainingPngs && remainingPngs.length > 0) {
                    pngByBaseName.set(baseName, remainingPngs);
                }
                else {
                    pngByBaseName.delete(baseName);
                }
            }
        }
        return { drawioPairs, skipFiles };
    }
    async createDrawioSvg(drawioPath, pngPath) {
        try {
            const drawioContent = await fs_1.promises.readFile(drawioPath, 'utf-8');
            const drawioBase64 = Buffer.from(drawioContent).toString('base64');
            let imageElement = '';
            if (pngPath) {
                try {
                    const pngBuffer = await fs_1.promises.readFile(pngPath);
                    const pngBase64 = pngBuffer.toString('base64');
                    imageElement = `<image href="data:image/png;base64,${pngBase64}" width="100%" height="100%"/>`;
                }
                catch (error) {
                    this.logger.warn(`Could not read PNG file for Draw.io diagram: ${pngPath}`, error);
                }
            }
            const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" 
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="600"
      height="400"
      viewBox="0 0 600 400"
      content="${drawioBase64}">${imageElement}</svg>`;
            return Buffer.from(svgContent, 'utf-8');
        }
        catch (error) {
            this.logger.error(`Failed to create Draw.io SVG: ${error}`);
            throw error;
        }
    }
    async uploadWithRetry(opts) {
        const { abs, storageFilePath, attachmentId, fileNameWithExt, ext, pageId, fileTask, uploadStats, } = opts;
        let lastError;
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const fileStream = (0, node_fs_1.createReadStream)(abs);
                await this.storageService.uploadStream(storageFilePath, fileStream, {
                    recreateClient: true,
                });
                const stat = await fs_1.promises.stat(abs);
                await this.db
                    .insertInto('attachments')
                    .values({
                    id: attachmentId,
                    filePath: storageFilePath,
                    fileName: fileNameWithExt,
                    fileSize: stat.size,
                    mimeType: (0, helpers_1.getMimeType)(fileNameWithExt),
                    type: 'file',
                    fileExt: ext,
                    creatorId: fileTask.creatorId,
                    workspaceId: fileTask.workspaceId,
                    pageId,
                    spaceId: fileTask.spaceId,
                })
                    .execute();
                const supportedExtensions = ['.pdf', '.docx'];
                if (supportedExtensions.includes(ext.toLowerCase())) {
                    try {
                        await this.attachmentQueue.add(constants_1.QueueJob.ATTACHMENT_INDEX_CONTENT, { attachmentId }, {
                            attempts: 1,
                            backoff: {
                                type: 'exponential',
                                delay: 3 * 60 * 1000,
                            },
                            deduplication: {
                                id: attachmentId,
                            },
                            removeOnComplete: true,
                            removeOnFail: false,
                        });
                        this.logger.debug(`Queued ${fileNameWithExt} for indexing (attachment ID: ${attachmentId})`);
                    }
                    catch (err) {
                        this.logger.error(`Failed to queue indexing for imported attachment ${attachmentId}: ${err}`);
                    }
                }
                uploadStats.completed++;
                if (uploadStats.completed % 10 === 0) {
                    this.logger.debug(`Upload progress: ${uploadStats.completed}/${uploadStats.total}`);
                }
                return;
            }
            catch (error) {
                lastError = error;
                this.logger.warn(`Upload attempt ${attempt}/${this.MAX_RETRIES} failed for ${fileNameWithExt}: ${error instanceof Error ? error.message : String(error)}`);
                if (attempt < this.MAX_RETRIES) {
                    await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY * attempt));
                }
            }
        }
        uploadStats.failed++;
        uploadStats.failedFiles.push(fileNameWithExt);
        this.logger.error(`Failed to upload ${fileNameWithExt} after ${this.MAX_RETRIES} attempts:`, lastError);
    }
};
exports.ImportAttachmentService = ImportAttachmentService;
exports.ImportAttachmentService = ImportAttachmentService = ImportAttachmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, nestjs_kysely_1.InjectKysely)()),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.QueueName.ATTACHMENT_QUEUE)),
    __metadata("design:paramtypes", [storage_service_1.StorageService, Object, bullmq_2.Queue])
], ImportAttachmentService);
//# sourceMappingURL=import-attachment.service.js.map