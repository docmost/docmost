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
var ImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const common_1 = require("@nestjs/common");
const page_repo_1 = require("../../../database/repos/page/page.repo");
const path = require("path");
const collaboration_util_1 = require("../../../collaboration/collaboration.util");
const nestjs_kysely_1 = require("nestjs-kysely");
const helpers_1 = require("../../../common/helpers");
const fractional_indexing_jittered_1 = require("fractional-indexing-jittered");
const transformer_1 = require("@hocuspocus/transformer");
const Y = require("yjs");
const editor_ext_1 = require("@docmost/editor-ext");
const file_utils_1 = require("../utils/file.utils");
const uuid_1 = require("uuid");
const storage_service_1 = require("../../storage/storage.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const constants_1 = require("../../queue/constants");
const core_1 = require("@nestjs/core");
const cheerio_1 = require("cheerio");
const import_formatter_1 = require("../utils/import-formatter");
let ImportService = ImportService_1 = class ImportService {
    constructor(pageRepo, storageService, db, fileTaskQueue, moduleRef) {
        this.pageRepo = pageRepo;
        this.storageService = storageService;
        this.db = db;
        this.fileTaskQueue = fileTaskQueue;
        this.moduleRef = moduleRef;
        this.logger = new common_1.Logger(ImportService_1.name);
    }
    async importPage(filePromise, userId, spaceId, workspaceId) {
        const file = await filePromise;
        const fileBuffer = await file.toBuffer();
        const fileExtension = path.extname(file.filename).toLowerCase();
        const fileName = (0, helpers_1.sanitizeFileName)(path.basename(file.filename, fileExtension));
        const fileContent = fileBuffer.toString();
        let prosemirrorState = null;
        let createdPage = null;
        const pageId = fileExtension === '.docx' || fileExtension === '.pdf'
            ? (0, uuid_1.v7)()
            : undefined;
        try {
            if (fileExtension.endsWith('.md')) {
                prosemirrorState = await this.processMarkdown(fileContent);
            }
            else if (fileExtension.endsWith('.html')) {
                prosemirrorState = await this.processHTML(fileContent);
            }
            else if (fileExtension.endsWith('.docx')) {
                prosemirrorState = await this.processDocx(fileBuffer, workspaceId, spaceId, pageId, userId);
            }
            else if (fileExtension.endsWith('.pdf')) {
                prosemirrorState = await this.processPdf(fileBuffer, workspaceId, spaceId, pageId, userId);
            }
        }
        catch (err) {
            const message = 'Error processing file content';
            this.logger.error(message, err);
            throw new common_1.BadRequestException(message);
        }
        if (!prosemirrorState) {
            const message = 'Failed to create ProseMirror state';
            this.logger.error(message);
            throw new common_1.BadRequestException(message);
        }
        const { title, prosemirrorJson } = this.extractTitleAndRemoveHeading(prosemirrorState);
        const pageTitle = title || fileName;
        if (prosemirrorJson) {
            try {
                const pagePosition = await this.getNewPagePosition(spaceId);
                createdPage = await this.pageRepo.insertPage({
                    ...(pageId ? { id: pageId } : {}),
                    slugId: (0, helpers_1.generateSlugId)(),
                    title: pageTitle,
                    content: prosemirrorJson,
                    textContent: (0, collaboration_util_1.jsonToText)(prosemirrorJson),
                    ydoc: await this.createYdoc(prosemirrorJson),
                    position: pagePosition,
                    spaceId: spaceId,
                    creatorId: userId,
                    workspaceId: workspaceId,
                    lastUpdatedById: userId,
                });
                this.logger.debug(`Successfully imported "${title}${fileExtension}. ID: ${createdPage.id} - SlugId: ${createdPage.slugId}"`);
            }
            catch (err) {
                const message = 'Failed to create imported page';
                this.logger.error(message, err);
                throw new common_1.BadRequestException(message);
            }
        }
        return createdPage;
    }
    async processMarkdown(markdownInput) {
        try {
            const html = await (0, editor_ext_1.markdownToHtml)(markdownInput);
            return this.processHTML(html);
        }
        catch (err) {
            throw err;
        }
    }
    async processHTML(htmlInput) {
        try {
            const $ = (0, cheerio_1.load)(htmlInput);
            (0, import_formatter_1.normalizeImportHtml)($, $.root());
            return (0, collaboration_util_1.htmlToJson)($.html() || '');
        }
        catch (err) {
            throw err;
        }
    }
    async processDocx(fileBuffer, workspaceId, spaceId, pageId, userId) {
        let DocxImportModule;
        try {
            DocxImportModule = require('./../../../ee/document-import/docx-import.service');
        }
        catch (err) {
            this.logger.error('DOCX import requested but EE module not bundled in this build');
            throw new common_1.BadRequestException('This feature requires a valid enterprise license.');
        }
        const docxImportService = this.moduleRef.get(DocxImportModule.DocxImportService, { strict: false });
        const html = await docxImportService.convertDocxToHtml(fileBuffer, workspaceId, spaceId, pageId, userId);
        return this.processHTML(html);
    }
    async processPdf(fileBuffer, workspaceId, spaceId, pageId, userId) {
        let PdfImportModule;
        try {
            PdfImportModule = require('./../../../ee/document-import/pdf-import.service');
        }
        catch (err) {
            this.logger.error('PDF import requested but EE module not bundled in this build');
            throw new common_1.BadRequestException('This feature requires a valid enterprise license.');
        }
        const pdfImportService = this.moduleRef.get(PdfImportModule.PdfImportService, { strict: false });
        const html = await pdfImportService.convertPdfToHtml(fileBuffer, workspaceId, spaceId, pageId, userId);
        return this.processHTML(html);
    }
    async createYdoc(prosemirrorJson) {
        if (prosemirrorJson) {
            const ydoc = transformer_1.TiptapTransformer.toYdoc(prosemirrorJson, 'default', collaboration_util_1.tiptapExtensions);
            Y.encodeStateAsUpdate(ydoc);
            return Buffer.from(Y.encodeStateAsUpdate(ydoc));
        }
        return null;
    }
    extractTitleAndRemoveHeading(prosemirrorState) {
        let title = null;
        const content = prosemirrorState.content ?? [];
        if (content.length > 0 &&
            content[0].type === 'heading' &&
            content[0].attrs?.level === 1) {
            title = content[0].content?.[0]?.text ?? null;
            content.shift();
        }
        if (content.length === 0) {
            content.push({
                type: 'paragraph',
                content: [],
            });
        }
        return {
            title,
            prosemirrorJson: {
                ...prosemirrorState,
                content,
            },
        };
    }
    async getNewPagePosition(spaceId, parentPageId) {
        let query = this.db
            .selectFrom('pages')
            .select(['id', 'position'])
            .where('spaceId', '=', spaceId)
            .orderBy('position', (ob) => ob.collate('C').desc())
            .limit(1);
        if (parentPageId) {
            query = query.where('parentPageId', '=', parentPageId);
        }
        else {
            query = query.where('parentPageId', 'is', null);
        }
        const lastPage = await query.executeTakeFirst();
        if (lastPage) {
            return (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(lastPage.position, null);
        }
        else {
            return (0, fractional_indexing_jittered_1.generateJitteredKeyBetween)(null, null);
        }
    }
    async importZip(filePromise, source, userId, spaceId, workspaceId) {
        const file = await filePromise;
        const fileExtension = path.extname(file.filename).toLowerCase();
        const fileName = (0, helpers_1.sanitizeFileName)(path.basename(file.filename, fileExtension));
        const fileNameWithExt = fileName + fileExtension;
        const fileTaskId = (0, uuid_1.v7)();
        const filePath = `${(0, file_utils_1.getFileTaskFolderPath)(file_utils_1.FileTaskType.Import, workspaceId)}/${fileTaskId}/${fileNameWithExt}`;
        const { stream, getBytesRead } = (0, helpers_1.createByteCountingStream)(file.file);
        await this.storageService.upload(filePath, stream);
        const fileSize = getBytesRead();
        const fileTask = await this.db
            .insertInto('fileTasks')
            .values({
            id: fileTaskId,
            type: file_utils_1.FileTaskType.Import,
            source: source,
            status: file_utils_1.FileTaskStatus.Processing,
            fileName: fileNameWithExt,
            filePath: filePath,
            fileSize: fileSize,
            fileExt: 'zip',
            creatorId: userId,
            spaceId: spaceId,
            workspaceId: workspaceId,
        })
            .returningAll()
            .executeTakeFirst();
        await this.fileTaskQueue.add(constants_1.QueueJob.IMPORT_TASK, {
            fileTaskId: fileTaskId,
        });
        return fileTask;
    }
};
exports.ImportService = ImportService;
exports.ImportService = ImportService = ImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, nestjs_kysely_1.InjectKysely)()),
    __param(3, (0, bullmq_1.InjectQueue)(constants_1.QueueName.FILE_TASK_QUEUE)),
    __metadata("design:paramtypes", [page_repo_1.PageRepo,
        storage_service_1.StorageService, Object, bullmq_2.Queue,
        core_1.ModuleRef])
], ImportService);
//# sourceMappingURL=import.service.js.map