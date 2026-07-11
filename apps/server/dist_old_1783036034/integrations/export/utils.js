"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERNAL_LINK_REGEX = void 0;
exports.getExportExtension = getExportExtension;
exports.getPageTitle = getPageTitle;
exports.updateAttachmentUrlsToLocalPaths = updateAttachmentUrlsToLocalPaths;
exports.replaceInternalLinks = replaceInternalLinks;
exports.getInternalLinkPageName = getInternalLinkPageName;
exports.extractPageSlugId = extractPageSlugId;
exports.buildTree = buildTree;
exports.computeLocalPath = computeLocalPath;
const collaboration_util_1 = require("../../collaboration/collaboration.util");
const common_1 = require("@nestjs/common");
const export_dto_1 = require("./dto/export-dto");
const path = require("path");
const utils_1 = require("../../common/helpers/prosemirror/utils");
exports.INTERNAL_LINK_REGEX = /^(https?:\/\/)?([^\/]+)?(\/s\/([^\/]+)\/)?p\/([a-zA-Z0-9-]+)\/?$/;
function getExportExtension(format) {
    if (format === export_dto_1.ExportFormat.HTML) {
        return '.html';
    }
    if (format === export_dto_1.ExportFormat.Markdown) {
        return '.md';
    }
    return;
}
function getPageTitle(title) {
    return title ? title : 'untitled';
}
function updateAttachmentUrlsToLocalPaths(prosemirrorJson) {
    const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
    if (!doc)
        return null;
    const replacePrefix = (url) => {
        const prefixes = ['/files', '/api/files'];
        for (const prefix of prefixes) {
            if (url.startsWith(prefix)) {
                return url.replace(prefix, 'files');
            }
        }
        return url;
    };
    doc?.descendants((node) => {
        if ((0, utils_1.isAttachmentNode)(node.type.name)) {
            if (node.attrs.src) {
                node.attrs.src = replacePrefix(node.attrs.src);
            }
            if (node.attrs.url) {
                node.attrs.url = replacePrefix(node.attrs.url);
            }
        }
    });
    return doc.toJSON();
}
function replaceInternalLinks(prosemirrorJson, slugIdToPath, currentPagePath, baseUrl) {
    const doc = (0, collaboration_util_1.jsonToNode)(prosemirrorJson);
    doc.descendants((node) => {
        for (const mark of node.marks) {
            if (mark.type.name === 'link' && mark.attrs.href) {
                const match = mark.attrs.href.match(exports.INTERNAL_LINK_REGEX);
                if (match) {
                    const markLink = mark.attrs.href;
                    const slugId = extractPageSlugId(match[5]);
                    const localPath = slugIdToPath[slugId];
                    if (!localPath) {
                        if (baseUrl && mark.attrs.href.startsWith('/')) {
                            mark.attrs.href = `${baseUrl}${mark.attrs.href}`;
                        }
                        continue;
                    }
                    const relativePath = computeRelativePath(currentPagePath, localPath);
                    mark.attrs.href = relativePath;
                    mark.attrs.target = '_self';
                    if (node.isText) {
                        if (markLink === node.text) {
                            node.text = getInternalLinkPageName(relativePath, currentPagePath);
                        }
                    }
                }
            }
        }
    });
    return doc.toJSON();
}
function getInternalLinkPageName(path, currentFilePath) {
    const name = path?.split('/').pop().split('.').slice(0, -1).join('.');
    try {
        return decodeURIComponent(name);
    }
    catch (err) {
        if (currentFilePath) {
            common_1.Logger.warn(`URI malformed in page ${currentFilePath}: ${name}. Falling back to raw name.`, 'ExportUtils');
        }
        return name;
    }
}
function extractPageSlugId(input) {
    if (!input) {
        return undefined;
    }
    const parts = input.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : input;
}
function buildTree(pages) {
    const tree = {};
    const titleCount = {};
    for (const page of pages) {
        const parentPageId = page.parentPageId;
        if (!titleCount[parentPageId]) {
            titleCount[parentPageId] = {};
        }
        let title = getPageTitle(page.title);
        if (titleCount[parentPageId][title]) {
            title = `${title} (${titleCount[parentPageId][title]})`;
            titleCount[parentPageId][getPageTitle(page.title)] += 1;
        }
        else {
            titleCount[parentPageId][title] = 1;
        }
        page.title = title;
        if (!tree[parentPageId]) {
            tree[parentPageId] = [];
        }
        tree[parentPageId].push(page);
    }
    return tree;
}
function computeLocalPath(tree, format, parentPageId, currentPath, slugIdToPath) {
    const children = tree[parentPageId] || [];
    for (const page of children) {
        const title = encodeURIComponent(getPageTitle(page.title));
        const localPath = `${currentPath}${title}`;
        slugIdToPath[page.slugId] = `${localPath}${getExportExtension(format)}`;
        computeLocalPath(tree, format, page.id, `${localPath}/`, slugIdToPath);
    }
}
function computeRelativePath(from, to) {
    return path.relative(path.dirname(from), to);
}
//# sourceMappingURL=utils.js.map