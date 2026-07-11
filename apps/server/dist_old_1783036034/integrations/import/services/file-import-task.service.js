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
var FileImportTaskService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileImportTaskService = void 0;
const common_1 = require("@nestjs/common");
const path = require("path");
const collaboration_util_1 = require("../../../collaboration/collaboration.util");
const nestjs_kysely_1 = require("nestjs-kysely");
const file_utils_1 = require("../utils/file.utils");
const storage_service_1 = require("../../storage/storage.service");
const tmp = require("tmp-promise");
const promises_1 = require("node:stream/promises");
const node_fs_1 = require("node:fs");
const import_service_1 = require("./import.service");
const fs_1 = require("fs");
const helpers_1 = require("../../../common/helpers");
const uuid_1 = require("uuid");
const fractional_indexing_jittered_1 = require("fractional-indexing-jittered");
const editor_ext_1 = require("@docmost/editor-ext");
const utils_1 = require("../../../common/helpers/prosemirror/utils");
const import_formatter_1 = require("../utils/import-formatter");
const import_utils_1 = require("../utils/import.utils");
const utils_2 = require("../../../database/utils");
const backlink_repo_1 = require("../../../database/repos/backlink/backlink.repo");
const import_attachment_service_1 = require("./import-attachment.service");
const core_1 = require("@nestjs/core");
const page_service_1 = require("../../../core/page/services/page.service");
const event_emitter_1 = require("@nestjs/event-emitter");
const event_contants_1 = require("../../../common/events/event.contants");
const audit_events_1 = require("../../../common/events/audit-events");
const audit_service_1 = require("../../../integrations/audit/audit.service");
let FileImportTaskService = FileImportTaskService_1 = class FileImportTaskService {
    constructor(storageService, importService, pageService, backlinkRepo, db, importAttachmentService, moduleRef, eventEmitter, auditService) {
        this.storageService = storageService;
        this.importService = importService;
        this.pageService = pageService;
        this.backlinkRepo = backlinkRepo;
        this.db = db;
        this.importAttachmentService = importAttachmentService;
        this.moduleRef = moduleRef;
        this.eventEmitter = eventEmitter;
        this.auditService = auditService;
        this.logger = new common_1.Logger(FileImportTaskService_1.name);
    }
    async processZIpImport(fileTaskId) {
        const fileTask = await this.db
            .selectFrom('fileTasks')
            .selectAll()
            .where('id', '=', fileTaskId)
            .executeTakeFirst();
        if (!fileTask) {
            this.logger.log(`Import file task with ID ${fileTaskId} not found`);
            return;
        }
        if (fileTask.status === file_utils_1.FileTaskStatus.Failed) {
            return;
        }
        if (fileTask.status === file_utils_1.FileTaskStatus.Success) {
            this.logger.log('Imported task already processed.');
            return;
        }
        const { path: tmpZipPath, cleanup: cleanupTmpFile } = await tmp.file({
            prefix: 'docmost-import',
            postfix: '.zip',
            discardDescriptor: true,
        });
        const { path: tmpExtractDir, cleanup: cleanupTmpDir } = await tmp.dir({
            prefix: 'docmost-extract-',
            unsafeCleanup: true,
        });
        try {
            const fileStream = await this.storageService.readStream(fileTask.filePath);
            await (0, promises_1.pipeline)(fileStream, (0, node_fs_1.createWriteStream)(tmpZipPath));
            await (0, file_utils_1.extractZip)(tmpZipPath, tmpExtractDir);
        }
        catch (err) {
            await cleanupTmpFile();
            await cleanupTmpDir();
            throw err;
        }
        try {
            if (fileTask.source === file_utils_1.FileImportSource.Generic ||
                fileTask.source === file_utils_1.FileImportSource.Notion) {
                await this.processGenericImport({
                    extractDir: tmpExtractDir,
                    fileTask,
                });
            }
            if (fileTask.source === file_utils_1.FileImportSource.Confluence) {
                let ConfluenceModule;
                try {
                    ConfluenceModule = require('./../../../ee/confluence-import/confluence-import.service');
                }
                catch (err) {
                    this.logger.error('Confluence import requested but EE module not bundled in this build');
                    return;
                }
                const confluenceImportService = this.moduleRef.get(ConfluenceModule.ConfluenceImportService, { strict: false });
                await confluenceImportService.processConfluenceImport({
                    extractDir: tmpExtractDir,
                    fileTask,
                });
            }
            try {
                await this.updateTaskStatus(fileTaskId, file_utils_1.FileTaskStatus.Success, null);
                await cleanupTmpFile();
                await cleanupTmpDir();
                await this.storageService.delete(fileTask.filePath);
            }
            catch (err) {
                this.logger.error(`Failed to delete import file from storage. Task ID: ${fileTaskId}`, err);
            }
        }
        catch (err) {
            await cleanupTmpFile();
            await cleanupTmpDir();
            throw err;
        }
    }
    async processGenericImport(opts) {
        const { extractDir, fileTask } = opts;
        const isNotion = fileTask.source === file_utils_1.FileImportSource.Notion;
        const allFiles = await (0, import_utils_1.collectMarkdownAndHtmlFiles)(extractDir);
        const attachmentCandidates = await (0, import_utils_1.buildAttachmentCandidates)(extractDir);
        const docmostMetadata = await (0, import_utils_1.readDocmostMetadata)(extractDir);
        const space = await this.db
            .selectFrom('spaces')
            .select(['slug'])
            .where('id', '=', fileTask.spaceId)
            .executeTakeFirst();
        const pagesMap = new Map();
        for (const absPath of allFiles) {
            const relPath = path
                .relative(extractDir, absPath)
                .split(path.sep)
                .join('/');
            const ext = path.extname(relPath).toLowerCase();
            const encodedPath = (0, import_utils_1.encodeFilePath)(relPath);
            const pageMetadata = docmostMetadata?.pages[encodedPath];
            pagesMap.set(relPath, {
                id: (0, uuid_1.v7)(),
                slugId: (0, helpers_1.generateSlugId)(),
                name: (0, import_utils_1.stripNotionID)(path.basename(relPath, ext)),
                content: '',
                parentPageId: null,
                fileExtension: ext,
                filePath: relPath,
                icon: pageMetadata?.icon ?? null,
            });
        }
        const foldersWithContent = new Set();
        pagesMap.forEach((page) => {
            const segments = page.filePath.split('/');
            segments.pop();
            let currentPath = '';
            for (const segment of segments) {
                currentPath = currentPath ? `${currentPath}/${segment}` : segment;
                foldersWithContent.add(currentPath);
            }
        });
        const rootLevelItems = new Set();
        pagesMap.forEach((page) => {
            const firstSegment = page.filePath.split('/')[0];
            rootLevelItems.add(firstSegment);
        });
        let skipRootFolder = null;
        if (rootLevelItems.size === 1) {
            const onlyRootItem = Array.from(rootLevelItems)[0];
            const hasRootFiles = Array.from(pagesMap.keys()).some((filePath) => !filePath.includes('/'));
            if (!hasRootFiles) {
                skipRootFolder = onlyRootItem;
            }
        }
        const sortedFolders = isNotion
            ? [...foldersWithContent].sort((a, b) => {
                const aHasPartial = (0, import_utils_1.extractNotionPartialId)(path.basename(a)) ? 0 : 1;
                const bHasPartial = (0, import_utils_1.extractNotionPartialId)(path.basename(b)) ? 0 : 1;
                return aHasPartial - bHasPartial;
            })
            : [...foldersWithContent];
        sortedFolders.forEach((folderPath) => {
            if (skipRootFolder &&
                folderPath?.toLowerCase() === skipRootFolder?.toLowerCase()) {
                return;
            }
            const mdPath = `${folderPath}.md`;
            const htmlPath = `${folderPath}.html`;
            if (!pagesMap.has(mdPath) && !pagesMap.has(htmlPath)) {
                const folderName = path.basename(folderPath);
                const parentDir = path.dirname(folderPath);
                let matched = false;
                if (isNotion) {
                    const partialId = (0, import_utils_1.extractNotionPartialId)(folderName);
                    const strippedFolderName = (0, import_utils_1.stripNotionID)(folderName);
                    const isSameDir = (fileDir) => fileDir === parentDir || (parentDir === '.' && !fileDir.includes('/'));
                    for (const [filePath, page] of pagesMap.entries()) {
                        if (!isSameDir(path.dirname(filePath)))
                            continue;
                        if (page.name !== strippedFolderName)
                            continue;
                        if (partialId) {
                            const fileBase = path.basename(filePath, path.extname(filePath));
                            const fullIdMatch = fileBase.match(/[a-f0-9]{32}$/i);
                            if (!fullIdMatch)
                                continue;
                            const fullId = fullIdMatch[0].toLowerCase();
                            if (!fullId.startsWith(partialId.prefix) || !fullId.endsWith(partialId.suffix)) {
                                continue;
                            }
                        }
                        pagesMap.delete(filePath);
                        page.filePath = mdPath;
                        pagesMap.set(mdPath, page);
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    const encodedMdPath = (0, import_utils_1.encodeFilePath)(mdPath);
                    const placeholderMetadata = docmostMetadata?.pages[encodedMdPath];
                    pagesMap.set(mdPath, {
                        id: (0, uuid_1.v7)(),
                        slugId: (0, helpers_1.generateSlugId)(),
                        name: (0, import_utils_1.stripNotionID)(folderName),
                        content: '',
                        parentPageId: null,
                        fileExtension: '.md',
                        filePath: mdPath,
                        icon: placeholderMetadata?.icon ?? null,
                    });
                }
            }
        });
        pagesMap.forEach((page, filePath) => {
            const segments = filePath.split('/');
            segments.pop();
            let parentPage = null;
            while (segments.length) {
                const tryMd = segments.join('/') + '.md';
                const tryHtml = segments.join('/') + '.html';
                if (pagesMap.has(tryMd)) {
                    parentPage = pagesMap.get(tryMd);
                    break;
                }
                if (pagesMap.has(tryHtml)) {
                    parentPage = pagesMap.get(tryHtml);
                    break;
                }
                segments.pop();
            }
            if (parentPage)
                page.parentPageId = parentPage.id;
        });
        const siblingsMap = new Map();
        pagesMap.forEach((page) => {
            const group = siblingsMap.get(page.parentPageId) ?? [];
            group.push(page);
            siblingsMap.set(page.parentPageId, group);
        });
        const encodedPathsMap = new Map();
        if (docmostMetadata) {
            pagesMap.forEach((_, filePath) => {
                encodedPathsMap.set(filePath, (0, import_utils_1.encodeFilePath)(filePath));
            });
        }
        const sortSiblings = (siblings) => {
            if (docmostMetadata) {
                siblings.sort((a, b) => {
                    const posA = docmostMetadata.pages[encodedPathsMap.get(a.filePath)]?.position;
                    const posB = docmostMetadata.pages[encodedPathsMap.get(b.filePath)]?.position;
                    if (posA && posB) {
                        if (posA < posB)
                            return -1;
                        if (posA > posB)
                            return 1;
                        return 0;
                    }
                    return a.name.localeCompare(b.name);
                });
            }
            else {
                siblings.sort((a, b) => a.name.localeCompare(b.name));
            }
        };
        const rootSibs = siblingsMap.get(null);
        if (rootSibs?.length) {
            sortSiblings(rootSibs);
            const nextPosition = await this.pageService.nextPagePosition(fileTask.spaceId);
            let prevPos = null;
            rootSibs.forEach((page, idx) => {
                if (idx === 0) {
                    page.position = nextPosition;
                }
                else {
                    page.position = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(prevPos, null);
                }
                prevPos = page.position;
            });
        }
        siblingsMap.forEach((sibs, parentId) => {
            if (parentId === null)
                return;
            sortSiblings(sibs);
            let prevPos = null;
            for (const page of sibs) {
                page.position = (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(prevPos, null);
                prevPos = page.position;
            }
        });
        const filePathToPageMetaMap = new Map();
        pagesMap.forEach((page) => {
            filePathToPageMetaMap.set(page.filePath, {
                id: page.id,
                title: page.name,
                slugId: page.slugId,
            });
        });
        const pagesByLevel = new Map();
        const pageLevel = new Map();
        const calculateLevels = () => {
            const queue = [];
            for (const [filePath, page] of pagesMap.entries()) {
                if (!page.parentPageId) {
                    queue.push({ filePath, level: 0 });
                    pageLevel.set(filePath, 0);
                }
            }
            while (queue.length > 0) {
                const { filePath, level } = queue.shift();
                const currentPage = pagesMap.get(filePath);
                for (const [childFilePath, childPage] of pagesMap.entries()) {
                    if (childPage.parentPageId === currentPage.id &&
                        !pageLevel.has(childFilePath)) {
                        pageLevel.set(childFilePath, level + 1);
                        queue.push({ filePath: childFilePath, level: level + 1 });
                    }
                }
            }
            for (const [filePath, page] of pagesMap.entries()) {
                const level = pageLevel.get(filePath) || 0;
                if (!pagesByLevel.has(level)) {
                    pagesByLevel.set(level, []);
                }
                pagesByLevel.get(level).push([filePath, page]);
            }
        };
        calculateLevels();
        if (pagesMap.size < 1)
            return;
        const allBacklinks = [];
        const validPageIds = new Set();
        const pageTitles = new Map();
        let totalPagesProcessed = 0;
        const sortedLevels = Array.from(pagesByLevel.keys()).sort((a, b) => a - b);
        try {
            await (0, utils_2.executeTx)(this.db, async (trx) => {
                for (const level of sortedLevels) {
                    const levelPages = pagesByLevel.get(level);
                    for (const [filePath, page] of levelPages) {
                        const absPath = path.join(extractDir, filePath);
                        let content = '';
                        try {
                            await fs_1.promises.access(absPath);
                            content = await fs_1.promises.readFile(absPath, 'utf-8');
                            if (page.fileExtension.toLowerCase() === '.md') {
                                content = await (0, editor_ext_1.markdownToHtml)(content);
                            }
                        }
                        catch (err) {
                            if (err?.code === 'ENOENT') {
                                content = '';
                            }
                            else {
                                throw err;
                            }
                        }
                        const htmlContent = await this.importAttachmentService.processAttachments({
                            html: content,
                            pageRelativePath: page.filePath,
                            extractDir,
                            pageId: page.id,
                            fileTask,
                            attachmentCandidates,
                        });
                        const { html, backlinks, pageIcon } = await (0, import_formatter_1.formatImportHtml)({
                            html: htmlContent,
                            currentFilePath: page.filePath,
                            filePathToPageMetaMap: filePathToPageMetaMap,
                            creatorId: fileTask.creatorId,
                            sourcePageId: page.id,
                            workspaceId: fileTask.workspaceId,
                            spaceSlug: space?.slug,
                        });
                        const pmState = (0, utils_1.getProsemirrorContent)(await this.importService.processHTML(html));
                        const { title, prosemirrorJson } = this.importService.extractTitleAndRemoveHeading(pmState);
                        const insertablePage = {
                            id: page.id,
                            slugId: page.slugId,
                            title: title || page.name,
                            icon: page.icon || pageIcon || null,
                            content: prosemirrorJson,
                            textContent: (0, collaboration_util_1.jsonToText)(prosemirrorJson),
                            ydoc: await this.importService.createYdoc(prosemirrorJson),
                            position: page.position,
                            spaceId: fileTask.spaceId,
                            workspaceId: fileTask.workspaceId,
                            creatorId: fileTask.creatorId,
                            lastUpdatedById: fileTask.creatorId,
                            parentPageId: page.parentPageId,
                        };
                        await trx.insertInto('pages').values(insertablePage).execute();
                        validPageIds.add(insertablePage.id);
                        pageTitles.set(insertablePage.id, insertablePage.title);
                        allBacklinks.push(...backlinks);
                        totalPagesProcessed++;
                        if (totalPagesProcessed % 50 === 0) {
                            this.logger.debug(`Processed ${totalPagesProcessed} pages...`);
                        }
                    }
                }
                const filteredBacklinks = allBacklinks.filter(({ sourcePageId, targetPageId }) => validPageIds.has(sourcePageId) && validPageIds.has(targetPageId));
                if (filteredBacklinks.length > 0) {
                    const BACKLINK_BATCH_SIZE = 100;
                    for (let i = 0; i < filteredBacklinks.length; i += BACKLINK_BATCH_SIZE) {
                        const backlinkChunk = filteredBacklinks.slice(i, Math.min(i + BACKLINK_BATCH_SIZE, filteredBacklinks.length));
                        await this.backlinkRepo.insertBacklink(backlinkChunk, trx);
                    }
                }
                if (validPageIds.size > 0) {
                    this.eventEmitter.emit(event_contants_1.EventName.PAGE_CREATED, {
                        pageIds: Array.from(validPageIds),
                        workspaceId: fileTask.workspaceId,
                    });
                }
                this.logger.log(`Successfully imported ${totalPagesProcessed} pages with ${filteredBacklinks.length} backlinks`);
            });
            if (validPageIds.size > 0) {
                const auditPayloads = Array.from(validPageIds).map((pageId) => ({
                    event: audit_events_1.AuditEvent.PAGE_CREATED,
                    resourceType: audit_events_1.AuditResource.PAGE,
                    resourceId: pageId,
                    spaceId: fileTask.spaceId,
                    metadata: {
                        source: fileTask.source,
                        fileTaskId: fileTask.id,
                        title: pageTitles.get(pageId),
                    },
                }));
                this.auditService.logBatchWithContext(auditPayloads, {
                    workspaceId: fileTask.workspaceId,
                    actorId: fileTask.creatorId,
                    actorType: 'user',
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to import files:', error);
            throw new Error(`File import failed: ${error?.['message']}`);
        }
    }
    async getFileTask(fileTaskId) {
        return this.db
            .selectFrom('fileTasks')
            .selectAll()
            .where('id', '=', fileTaskId)
            .executeTakeFirst();
    }
    async updateTaskStatus(fileTaskId, status, errorMessage) {
        try {
            await this.db
                .updateTable('fileTasks')
                .set({ status: status, errorMessage, updatedAt: new Date() })
                .where('id', '=', fileTaskId)
                .execute();
        }
        catch (err) {
            this.logger.error(err);
        }
    }
};
exports.FileImportTaskService = FileImportTaskService;
exports.FileImportTaskService = FileImportTaskService = FileImportTaskService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, nestjs_kysely_1.InjectKysely)()),
    __param(8, (0, common_1.Inject)(audit_service_1.AUDIT_SERVICE)),
    __metadata("design:paramtypes", [storage_service_1.StorageService,
        import_service_1.ImportService,
        page_service_1.PageService,
        backlink_repo_1.BacklinkRepo, Object, import_attachment_service_1.ImportAttachmentService,
        core_1.ModuleRef,
        event_emitter_1.EventEmitter2, Object])
], FileImportTaskService);
//# sourceMappingURL=file-import-task.service.js.map