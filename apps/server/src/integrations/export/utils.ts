import { jsonToNode } from 'src/collaboration/collaboration.util';
import { Logger } from '@nestjs/common';
import { ExportFormat } from './dto/export-dto';
import { Node } from '@tiptap/pm/model';
import { validate as isValidUUID } from 'uuid';
import * as path from 'path';
import { Page } from '@docmost/db/types/entity.types';
import { isAttachmentNode } from '../../common/helpers/prosemirror/utils';
import { sanitizeFileName } from '../../common/helpers';

export type PageExportTree = Record<string, Page[]>;

export const INTERNAL_LINK_REGEX =
  /^(https?:\/\/)?([^\/]+)?(\/s\/([^\/]+)\/)?p\/([a-zA-Z0-9-]+)\/?$/;

export function getExportExtension(format: string) {
  if (format === ExportFormat.HTML) {
    return '.html';
  }

  if (format === ExportFormat.Markdown) {
    return '.md';
  }
  return;
}

export function getPageTitle(title: string) {
  return title ? title : 'untitled';
}

export function getSafePageTitle(title: string): string {
  const sanitized = sanitizeFileName(getPageTitle(title), {
    preserveSpaces: true,
  });
  return sanitized || 'untitled';
}

export function updateAttachmentUrlsToLocalPaths(
  prosemirrorJson: any,
  attachments?: ReadonlyMap<string, { fileName: string }>,
) {
  const doc = jsonToNode(prosemirrorJson);
  if (!doc) return null;

  const replacePrefix = (url: string): string => {
    const local = url.replace(/^\/(?:api\/)?files\//, 'files/');
    const match = /^files\/([^/]+)\/[^?#]+([?#].*)?$/.exec(local);
    const attachment = match && attachments?.get(match[1]);
    if (!attachment) return local;
    return `files/${match[1]}/${encodeURIComponent(attachment.fileName)}${match[2] || ''}`;
  };

  doc?.descendants((node: Node) => {
    if (isAttachmentNode(node.type.name)) {
      const attrs = node.attrs as Record<string, string>;
      if (node.type.name === 'drawio' || node.type.name === 'excalidraw') {
        const attachment = attachments?.get(attrs.attachmentId);
        if (attachment) attrs.title = attachment.fileName;
      }
      if (attrs.src) attrs.src = replacePrefix(attrs.src);
      if (attrs.url) attrs.url = replacePrefix(attrs.url);
    }
  });

  return doc.toJSON();
}

export function replaceInternalLinks(
  prosemirrorJson: any,
  slugIdToPath: Record<string, string>,
  currentPagePath: string,
  baseUrl?: string,
) {
  const doc = jsonToNode(prosemirrorJson);

  doc.descendants((node: Node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && mark.attrs.href) {
        const match = mark.attrs.href.match(INTERNAL_LINK_REGEX);
        if (match) {
          const markLink = mark.attrs.href;

          const slugId = extractPageSlugId(match[5]);
          const localPath = slugIdToPath[slugId];

          if (!localPath) {
            if (baseUrl && mark.attrs.href.startsWith('/')) {
              //@ts-expect-error
              mark.attrs.href = `${baseUrl}${mark.attrs.href}`;
            }
            continue;
          }

          const relativePath = computeRelativePath(currentPagePath, localPath);

          //@ts-expect-error
          mark.attrs.href = relativePath;
          //@ts-expect-error
          mark.attrs.target = '_self';
          if (node.isText) {
            // if link and text are same, use page title
            if (markLink === node.text) {
              //@ts-expect-error
              node.text = getInternalLinkPageName(relativePath, currentPagePath);
            }
          }
        }
      }
    }
  });

  return doc.toJSON();
}

export function getInternalLinkPageName(path: string, currentFilePath?: string): string {
  const name = path?.split('/').pop().split('.').slice(0, -1).join('.');
  try {
    return decodeURIComponent(name);
  } catch (err) {
    if (currentFilePath) {
      Logger.warn(
        `URI malformed in page ${currentFilePath}: ${name}. Falling back to raw name.`,
        'ExportUtils',
      );
    }
    return name;
  }
}

export function extractPageSlugId(input: string): string {
  if (!input) {
    return undefined;
  }
  const parts = input.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : input;
}

// the file name a page gets, compared the way case-insensitive file systems do
function fileNameKey(title: string): string {
  return getSafePageTitle(title).normalize('NFC').toLowerCase();
}

function truncateUtf8Bytes(text: string, maxBytes: number): string {
  let out = '';
  for (const char of text) {
    if (Buffer.byteLength(out + char) > maxBytes) break;
    out += char;
  }
  return out;
}

export function buildTree(pages: Page[]): PageExportTree {
  const tree: PageExportTree = {};
  const usedFileNames: Record<string, Set<string>> = {};

  for (const page of pages) {
    const parentPageId = page.parentPageId;

    if (!usedFileNames[parentPageId]) {
      usedFileNames[parentPageId] = new Set();
    }
    const used = usedFileNames[parentPageId];

    const title = getPageTitle(page.title);
    let uniqueTitle = title;
    // shortened first, so the number survives the 255-byte cap on file names
    for (let n = 1; used.has(fileNameKey(uniqueTitle)); n++) {
      const suffix = ` (${n})`;
      uniqueTitle = truncateUtf8Bytes(title, 255 - suffix.length) + suffix;
    }
    used.add(fileNameKey(uniqueTitle));

    page.title = uniqueTitle;
    if (!tree[parentPageId]) {
      tree[parentPageId] = [];
    }
    tree[parentPageId].push(page);
  }
  return tree;
}

export function computeLocalPath(
  tree: PageExportTree,
  format: string,
  parentPageId: string | null,
  currentPath: string,
  slugIdToPath: Record<string, string>,
) {
  const children = tree[parentPageId] || [];

  for (const page of children) {
    const title = encodeURIComponent(getSafePageTitle(page.title));
    const localPath = `${currentPath}${title}`;
    slugIdToPath[page.slugId] = `${localPath}${getExportExtension(format)}`;

    computeLocalPath(tree, format, page.id, `${localPath}/`, slugIdToPath);
  }
}

function computeRelativePath(from: string, to: string) {
  return path.relative(path.dirname(from), to);
}
