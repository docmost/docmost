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
var ExportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
const common_1 = require("@nestjs/common");
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const export_dto_1 = require("./dto/export-dto");
const nestjs_kysely_1 = require("nestjs-kysely");
const JSZip = require("jszip");
const storage_service_1 = require("../storage/storage.service");
const utils_1 = require("./utils");
const page_repo_1 = require("../../database/repos/page/page.repo");
const page_permission_repo_1 = require("../../database/repos/page/page-permission.repo");
const state_1 = require("@tiptap/pm/state");
const slugify_1 = require("@sindresorhus/slugify");
const packageJson = require('../../../package.json');
const environment_service_1 = require("../environment/environment.service");
const domain_service_1 = require("../environment/domain.service");
const utils_2 = require("../../common/helpers/prosemirror/utils");
const editor_ext_1 = require("@docmost/editor-ext");
let ExportService = ExportService_1 = class ExportService {
    constructor(pageRepo, pagePermissionRepo, db, storageService, environmentService, domainService) {
        this.pageRepo = pageRepo;
        this.pagePermissionRepo = pagePermissionRepo;
        this.db = db;
        this.storageService = storageService;
        this.environmentService = environmentService;
        this.domainService = domainService;
        this.logger = new common_1.Logger(ExportService_1.name);
    }
    async exportPage(format, page, singlePage) {
        const titleNode = {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: (0, utils_1.getPageTitle)(page.title) }],
        };
        let prosemirrorJson;
        if (singlePage) {
            const baseUrl = await this.getWorkspaceBaseUrl(page.workspaceId);
            prosemirrorJson = await this.turnPageMentionsToLinks((0, utils_2.getProsemirrorContent)(page.content), page.workspaceId, baseUrl);
        }
        else {
            prosemirrorJson = (0, utils_2.getProsemirrorContent)(page.content);
        }
        if (page.title) {
            prosemirrorJson.content.unshift(titleNode);
        }
        const pageHtml = (0, collaboration_util_1.jsonToHtml)(prosemirrorJson);
        if (format === export_dto_1.ExportFormat.HTML) {
            return `<!DOCTYPE html>
      <html>
        <head>
         <title>${(0, utils_1.getPageTitle)(page.title)}</title>
        </head>
        <body>${pageHtml}</body>
      </html>`;
        }
        if (format === export_dto_1.ExportFormat.Markdown) {
            const newPageHtml = pageHtml.replace(/<colgroup[^>]*>[\s\S]*?<\/colgroup>/gim, '');
            return (0, editor_ext_1.htmlToMarkdown)(newPageHtml);
        }
        return;
    }
    async exportPages(pageId, format, includeAttachments, includeChildren, userId, ignorePermissions = false) {
        let pages;
        if (includeChildren) {
            pages = await this.pageRepo.getPageAndDescendants(pageId, {
                includeContent: true,
            });
        }
        else {
            const page = await this.pageRepo.findById(pageId, {
                includeContent: true,
            });
            if (page) {
                pages = [page];
            }
        }
        if (!pages || pages.length === 0) {
            throw new common_1.BadRequestException('No pages to export');
        }
        if (!ignorePermissions && userId) {
            pages = await this.filterPagesForExport(pages, pageId, userId, pages[0].spaceId);
            if (pages.length === 0) {
                throw new common_1.BadRequestException('No accessible pages to export');
            }
        }
        const parentPageIndex = pages.findIndex((obj) => obj.id === pageId);
        if (parentPageIndex === -1) {
            throw new common_1.BadRequestException('Root page is not accessible');
        }
        pages[parentPageIndex].parentPageId = null;
        const isSinglePage = pages.length === 1 && !includeAttachments;
        if (isSinglePage) {
            const pageContent = await this.exportPage(format, pages[0], true);
            return { type: 'file', content: pageContent, page: pages[0] };
        }
        const tree = (0, utils_1.buildTree)(pages);
        const baseUrl = await this.getWorkspaceBaseUrl(pages[0].workspaceId);
        const zip = new JSZip();
        await this.zipPages(tree, format, zip, includeAttachments, baseUrl, userId, ignorePermissions);
        const zipFile = zip.generateNodeStream({
            type: 'nodebuffer',
            streamFiles: true,
            compression: 'DEFLATE',
        });
        return { type: 'zip', stream: zipFile, page: pages[0] };
    }
    async exportSpace(spaceId, format, includeAttachments, userId, ignorePermissions = false) {
        const space = await this.db
            .selectFrom('spaces')
            .select(['id', 'name'])
            .where('id', '=', spaceId)
            .executeTakeFirst();
        if (!space) {
            throw new common_1.NotFoundException('Space not found');
        }
        let pages = await this.db
            .selectFrom('pages')
            .select([
            'pages.id',
            'pages.slugId',
            'pages.title',
            'pages.icon',
            'pages.position',
            'pages.content',
            'pages.parentPageId',
            'pages.spaceId',
            'pages.workspaceId',
            'pages.createdAt',
            'pages.updatedAt',
        ])
            .where('spaceId', '=', spaceId)
            .where('deletedAt', 'is', null)
            .execute();
        if (!ignorePermissions && userId) {
            pages = await this.filterPagesForExport(pages, null, userId, spaceId);
            if (pages.length === 0) {
                throw new common_1.BadRequestException('No accessible pages to export');
            }
        }
        const tree = (0, utils_1.buildTree)(pages);
        const baseUrl = await this.getWorkspaceBaseUrl(pages[0].workspaceId);
        const zip = new JSZip();
        await this.zipPages(tree, format, zip, includeAttachments, baseUrl, userId, ignorePermissions);
        const zipFile = zip.generateNodeStream({
            type: 'nodebuffer',
            streamFiles: true,
            compression: 'DEFLATE',
        });
        const fileName = `${space.name}-space-export.zip`;
        return {
            fileStream: zipFile,
            fileName,
            spaceName: space.name,
        };
    }
    async zipPages(tree, format, zip, includeAttachments, baseUrl, userId, ignorePermissions = false) {
        const slugIdToPath = {};
        const pageIdToFilePath = {};
        const pagesMetadata = {};
        (0, utils_1.computeLocalPath)(tree, format, null, '', slugIdToPath);
        const allowedAttachments = includeAttachments
            ? await this.resolveAccessibleAttachments(tree, userId, ignorePermissions)
            : new Map();
        const stack = [
            { folder: zip, parentPageId: null },
        ];
        while (stack.length > 0) {
            const { folder, parentPageId } = stack.pop();
            const children = tree[parentPageId] || [];
            for (const page of children) {
                const childPages = tree[page.id] || [];
                const prosemirrorJson = await this.turnPageMentionsToLinks((0, utils_2.getProsemirrorContent)(page.content), page.workspaceId, baseUrl, userId, ignorePermissions);
                const currentPagePath = slugIdToPath[page.slugId];
                let updatedJsonContent = (0, utils_1.replaceInternalLinks)(prosemirrorJson, slugIdToPath, currentPagePath, baseUrl);
                if (includeAttachments) {
                    await this.zipAttachments(updatedJsonContent, folder, allowedAttachments);
                    updatedJsonContent =
                        (0, utils_1.updateAttachmentUrlsToLocalPaths)(updatedJsonContent);
                }
                const pageTitle = (0, utils_1.getPageTitle)(page.title);
                const pageExportContent = await this.exportPage(format, {
                    ...page,
                    content: updatedJsonContent,
                });
                folder.file(`${pageTitle}${(0, utils_1.getExportExtension)(format)}`, pageExportContent);
                pageIdToFilePath[page.id] = currentPagePath;
                const parentPath = parentPageId ? pageIdToFilePath[parentPageId] : null;
                pagesMetadata[currentPagePath] = {
                    pageId: page.id,
                    slugId: page.slugId,
                    icon: page.icon ?? null,
                    position: page.position,
                    parentPath,
                    createdAt: page.createdAt?.toISOString() ?? new Date().toISOString(),
                    updatedAt: page.updatedAt?.toISOString() ?? new Date().toISOString(),
                };
                if (childPages.length > 0) {
                    const pageFolder = folder.folder(pageTitle);
                    stack.push({ folder: pageFolder, parentPageId: page.id });
                }
            }
        }
        const metadata = {
            exportedAt: new Date().toISOString(),
            source: 'docmost',
            version: packageJson.version,
            pages: pagesMetadata,
        };
        zip.file('docmost-metadata.json', JSON.stringify(metadata, null, 2));
    }
    async zipAttachments(prosemirrorJson, zip, allowed) {
        const attachmentIds = (0, utils_2.getAttachmentIds)(prosemirrorJson);
        await Promise.all(attachmentIds.map(async (id) => {
            const attachment = allowed.get(id);
            if (!attachment)
                return;
            try {
                const fileBuffer = await this.storageService.read(attachment.filePath);
                const filePath = `/files/${attachment.id}/${attachment.fileName}`;
                zip.file(filePath, fileBuffer);
            }
            catch (err) {
                this.logger.debug(`Attachment export error ${attachment.id}`, err);
            }
        }));
    }
    async resolveAccessibleAttachments(tree, userId, ignorePermissions) {
        const allAttachmentIds = new Set();
        let spaceId;
        for (const siblings of Object.values(tree)) {
            for (const page of siblings) {
                if (!spaceId)
                    spaceId = page.spaceId;
                for (const id of (0, utils_2.getAttachmentIds)((0, utils_2.getProsemirrorContent)(page.content))) {
                    allAttachmentIds.add(id);
                }
            }
        }
        if (allAttachmentIds.size === 0 || !spaceId) {
            return new Map();
        }
        const attachments = await this.db
            .selectFrom('attachments')
            .select(['id', 'fileName', 'filePath', 'pageId'])
            .where('id', 'in', [...allAttachmentIds])
            .where('spaceId', '=', spaceId)
            .execute();
        let visible = attachments;
        if (!ignorePermissions && userId) {
            const ownerPageIds = [
                ...new Set(attachments
                    .map((a) => a.pageId)
                    .filter((id) => !!id)),
            ];
            const accessible = ownerPageIds.length
                ? await this.pagePermissionRepo.filterAccessiblePageIds({
                    pageIds: ownerPageIds,
                    userId,
                    spaceId,
                })
                : [];
            const accessibleSet = new Set(accessible);
            visible = attachments.filter((a) => a.pageId && accessibleSet.has(a.pageId));
        }
        return new Map(visible.map((a) => [a.id, a]));
    }
    async turnPageMentionsToLinks(prosemirrorJson, workspaceId, baseUrl, userId, ignorePermissions = false) {
        const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
        let pageMentionIds = [];
        doc.descendants((node) => {
            if (node.type.name === 'mention' && node.attrs.entityType === 'page') {
                if (node.attrs.entityId) {
                    pageMentionIds.push(node.attrs.entityId);
                }
            }
        });
        if (pageMentionIds.length < 1) {
            return prosemirrorJson;
        }
        if (!ignorePermissions && userId) {
            pageMentionIds = await this.pagePermissionRepo.filterAccessiblePageIds({
                pageIds: pageMentionIds,
                userId,
            });
        }
        const pages = pageMentionIds.length > 0
            ? await this.db
                .selectFrom('pages')
                .select([
                'id',
                'slugId',
                'title',
                'creatorId',
                'spaceId',
                'workspaceId',
            ])
                .select((eb) => this.pageRepo.withSpace(eb))
                .where('id', 'in', pageMentionIds)
                .where('workspaceId', '=', workspaceId)
                .execute()
            : [];
        const pageMap = new Map(pages.map((page) => [page.id, page]));
        let editorState = state_1.EditorState.create({
            doc: doc,
        });
        const transaction = editorState.tr;
        let offset = 0;
        const replaceMentionWithLink = (node, pos, title, slugId, spaceSlug) => {
            const linkTitle = title || 'untitled';
            const truncatedTitle = linkTitle?.substring(0, 70);
            const pageSlug = `${(0, slugify_1.default)(truncatedTitle)}-${slugId}`;
            const link = `${baseUrl}/s/${spaceSlug}/p/${pageSlug}`;
            const linkMark = editorState.schema.marks.link.create({ href: link });
            const linkTextNode = editorState.schema.text(linkTitle, [linkMark]);
            const from = pos + offset;
            const to = pos + offset + node.nodeSize;
            transaction.replaceWith(from, to, linkTextNode);
            offset += linkTextNode.nodeSize - node.nodeSize;
        };
        editorState.doc.descendants((node, pos) => {
            if (node.type.name === 'mention' && node.attrs.entityType === 'page') {
                const { entityId: pageId, slugId, label } = node.attrs;
                const page = pageMap.get(pageId);
                if (page) {
                    replaceMentionWithLink(node, pos, page.title, page.slugId, page.space.slug);
                }
                else {
                    replaceMentionWithLink(node, pos, label, slugId, 'undefined');
                }
            }
        });
        if (transaction.docChanged) {
            editorState = editorState.apply(transaction);
        }
        const updatedDoc = editorState.doc;
        return updatedDoc.toJSON();
    }
    async getWorkspaceBaseUrl(workspaceId) {
        const workspace = await this.db
            .selectFrom('workspaces')
            .select('hostname')
            .where('id', '=', workspaceId)
            .executeTakeFirst();
        return this.domainService.getUrl(workspace?.hostname);
    }
    async filterPagesForExport(pages, rootPageId, userId, spaceId) {
        if (pages.length === 0)
            return [];
        const pageIds = pages.map((p) => p.id);
        const accessibleIds = await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
            spaceId,
        });
        const accessibleSet = new Set(accessibleIds);
        const includedIds = new Set();
        let changed = true;
        while (changed) {
            changed = false;
            for (const page of pages) {
                if (includedIds.has(page.id))
                    continue;
                if (!accessibleSet.has(page.id))
                    continue;
                if (page.id === rootPageId ||
                    (rootPageId === null && page.parentPageId === null)) {
                    includedIds.add(page.id);
                    changed = true;
                    continue;
                }
                if (page.parentPageId && includedIds.has(page.parentPageId)) {
                    includedIds.add(page.id);
                    changed = true;
                }
            }
        }
        return pages.filter((p) => includedIds.has(p.id));
    }
};
exports.ExportService = ExportService;
exports.ExportService = ExportService = ExportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, nestjs_kysely_1.InjectKysely)()),
    __metadata("design:paramtypes", [page_repo_1.PageRepo,
        page_permission_repo_1.PagePermissionRepo, Object, storage_service_1.StorageService,
        environment_service_1.EnvironmentService,
        domain_service_1.DomainService])
], ExportService);
//# sourceMappingURL=export.service.js.map